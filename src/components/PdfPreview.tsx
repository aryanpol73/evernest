import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export function PdfPreview({ file }: { file: Blob }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const target = container.current;
    if (!target) return;
    target.replaceChildren();
    setStatus("loading");

    (async () => {
      try {
        // Loaded on demand, because PDF.js is large and most pages never need it.
        const [{ renderPdf }, data] = await Promise.all([import("@/lib/pdfRender"), file.arrayBuffer()]);
        await renderPdf(data, target, () => cancelled);
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div>
      {status === "loading" && <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-primary" aria-label="Loading preview" />}
      {status === "failed" && <p className="py-8 text-center text-sm text-muted-foreground">We couldn't show this PDF. Download it to open it.</p>}
      <div ref={container} />
    </div>
  );
}
