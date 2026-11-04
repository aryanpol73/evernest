import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 50;

// Mobile browsers can't show a PDF in a frame, so pages are drawn onto canvases.
// That also keeps a stored file from running in a browser's own viewer.
export async function renderPdf(data: ArrayBuffer, container: HTMLElement, isCancelled: () => boolean): Promise<void> {
  const pdf = await getDocument({ data, isEvalSupported: false }).promise;
  try {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number++) {
      if (isCancelled()) return;
      const page = await pdf.getPage(number);
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (container.clientWidth / unscaled.width) * scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.className = "mb-2 rounded border bg-white";
      container.appendChild(canvas);

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      await page.render({ canvasContext: context, viewport }).promise;
    }
  } finally {
    await pdf.destroy();
  }
}
