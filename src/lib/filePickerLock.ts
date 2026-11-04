// Opening a file picker hides the page on phones. Locking then would replace the
// upload form and lose the chosen file, so the PIN lock waits while a picker is open.
// Not every browser reports a cancelled picker, so the wait is capped.
const MAX_PICKER_MS = 5 * 60 * 1000;

let pickerOpenedAt: number | null = null;

export function isFilePickerOpen(now = Date.now()): boolean {
  return pickerOpenedAt !== null && now - pickerOpenedAt < MAX_PICKER_MS;
}

const isFileInput = (target: EventTarget | null) => target instanceof HTMLInputElement && target.type === "file";

export function watchFilePickers(root: Document = document): () => void {
  const onClick = (e: Event) => {
    if (isFileInput(e.target)) pickerOpenedAt = Date.now();
  };
  const onClosed = (e: Event) => {
    if (isFileInput(e.target)) pickerOpenedAt = null;
  };

  root.addEventListener("click", onClick, true);
  root.addEventListener("change", onClosed, true);
  root.addEventListener("cancel", onClosed, true);

  return () => {
    pickerOpenedAt = null;
    root.removeEventListener("click", onClick, true);
    root.removeEventListener("change", onClosed, true);
    root.removeEventListener("cancel", onClosed, true);
  };
}
