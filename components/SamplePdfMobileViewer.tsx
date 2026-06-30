"use client";

import { useEffect, useRef, useState } from "react";

type SamplePdfMobileViewerProps = {
  url: string;
};

type ViewerState =
  | { status: "loading" }
  | { status: "ready"; pageCount: number }
  | { status: "error" };

export default function SamplePdfMobileViewer({ url }: SamplePdfMobileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.replaceChildren();
    setViewerState({ status: "loading" });

    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) {
          return;
        }

        const pageCount = pdf.numPages;
        const activeContainer = containerRef.current;
        if (!activeContainer || cancelled) {
          return;
        }

        const containerWidth =
          activeContainer.clientWidth > 0 ? activeContainer.clientWidth : Math.min(window.innerWidth - 24, 480);

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) {
            return;
          }

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block h-auto w-full max-w-full";

          const pageShell = document.createElement("div");
          pageShell.className = "w-full";

          const pageLabel = document.createElement("p");
          pageLabel.className = "mb-2 text-center text-[0.58rem] uppercase tracking-[0.16em] text-[#8f9aac]";
          pageLabel.textContent = `Page ${pageNumber} / ${pageCount}`;

          pageShell.append(pageLabel, canvas);
          activeContainer.append(pageShell);

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;
        }

        if (!cancelled) {
          setViewerState({ status: "ready", pageCount });
        }
      } catch {
        if (!cancelled) {
          setViewerState({ status: "error" });
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d9bd78]/18 bg-[#0a0c12]">
      {viewerState.status === "loading" ? (
        <p className="p-6 text-center text-sm text-[#9baabd]">Loading sample PDF...</p>
      ) : null}

      {viewerState.status === "error" ? (
        <p className="p-6 text-center text-sm text-red-200">Unable to load the sample PDF. Please try again.</p>
      ) : null}

      {viewerState.status === "ready" ? (
        <p className="border-b border-[#d9bd78]/12 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.14em] text-[#9baabd]">
          {viewerState.pageCount} pages · scroll to view all
        </p>
      ) : null}

      <div
        ref={containerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-2 py-3 [-webkit-overflow-scrolling:touch]"
        aria-label={viewerState.status === "ready" ? `Sample PDF, ${viewerState.pageCount} pages` : "Sample PDF"}
      />
    </div>
  );
}
