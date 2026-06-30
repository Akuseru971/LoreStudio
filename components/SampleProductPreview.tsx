"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const MP3_SAMPLE_URL =
  "https://Video-Invocation.b-cdn.net/ElevenLabs_2026-06-30T10_46_58_Wolf_ivc_sp100_s50_sb75_v3.mp3";
export const PDF_SAMPLE_URL = "https://Video-Invocation.b-cdn.net/book%20(2).pdf";

type SampleProductPreviewProps = {
  title: string;
  subtitle: string;
  disabled?: boolean;
};

export default function SampleProductPreview({ title, subtitle, disabled = false }: SampleProductPreviewProps) {
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  useEffect(() => {
    if (!isPdfPreviewOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPdfPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPdfPreviewOpen]);

  return (
    <>
      <section aria-label="Sample preview" className="mt-5 rounded-2xl border border-[#d9bd78]/14 bg-black/22 p-4">
        <h3 className="font-cover-title text-base leading-tight text-[#f7ebce]">{title}</h3>
        <p className="mt-1.5 text-xs leading-6 text-[#9baabd]">{subtitle}</p>

        <div className="mt-3.5 space-y-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">Sample audio chapter</p>
            <audio controls preload="none" className="mt-2 h-9 w-full max-w-full" src={MP3_SAMPLE_URL}>
              Your browser does not support the audio element.
            </audio>
          </div>

          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">Sample illustrated PDF</p>
            <button
              type="button"
              onClick={() => setIsPdfPreviewOpen(true)}
              disabled={disabled}
              className="mt-2 w-full rounded-xl border border-[#d9bd78]/24 bg-[#d9bd78]/10 px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-[#f7ebce] transition hover:border-[#d9bd78]/40 hover:bg-[#d9bd78]/16 disabled:opacity-60"
            >
              Open sample PDF
            </button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {isPdfPreviewOpen ? (
          <motion.div
            key="sample-pdf-preview"
            className="fixed inset-0 z-[150] flex flex-col bg-[#02030a]/96 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Sample PDF preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-title text-[0.62rem] uppercase tracking-[0.22em] text-[#d9bd78]/85">
                Sample illustrated PDF
              </p>
              <button
                type="button"
                onClick={() => setIsPdfPreviewOpen(false)}
                aria-label="Close sample PDF preview"
                className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#e8dcc0] transition hover:border-[#d9bd78]/35"
              >
                Close
              </button>
            </div>
            <iframe
              title="Sample illustrated PDF preview"
              src={PDF_SAMPLE_URL}
              className="min-h-0 flex-1 rounded-2xl border border-[#d9bd78]/18 bg-[#0a0c12]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
