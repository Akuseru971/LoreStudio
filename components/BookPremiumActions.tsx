"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BookPremiumActionsProps = {
  accessToken: string;
  className?: string;
};

type PdfStatus = "idle" | "preparing_images" | "generating_pdf" | "ready" | "failed";

type PdfDownloadResponse = {
  status?: "ready" | "preparing_images" | "generating_pdf" | "failed";
  downloadUrl?: string;
  message?: string;
};

const PDF_POLL_INTERVAL_MS = 4000;
const PDF_POLL_MAX_ATTEMPTS = 45;

export default function BookPremiumActions({ accessToken, className }: BookPremiumActionsProps) {
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mp3Error, setMp3Error] = useState<string | null>(null);
  const pdfPollRef = useRef(0);

  useEffect(() => {
    return () => {
      pdfPollRef.current += 1;
    };
  }, []);

  const requestPdfDownload = useCallback(async (): Promise<PdfDownloadResponse> => {
    const response = await fetch(`/api/download-pdf?token=${encodeURIComponent(accessToken)}`);
    return (await response.json()) as PdfDownloadResponse;
  }, [accessToken]);

  const handleDownloadPdf = useCallback(async () => {
    pdfPollRef.current += 1;
    const pollId = pdfPollRef.current;

    setPdfStatus("preparing_images");
    setPdfError(null);

    for (let attempt = 0; attempt < PDF_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (pdfPollRef.current !== pollId) {
        return;
      }

      try {
        const data = await requestPdfDownload();

        if (data.status === "ready" && data.downloadUrl) {
          window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
          setPdfStatus("idle");
          return;
        }

        if (data.status === "preparing_images") {
          setPdfStatus("preparing_images");
        } else if (data.status === "generating_pdf") {
          setPdfStatus("generating_pdf");
        } else if (data.status === "failed") {
          setPdfStatus("failed");
          setPdfError(data.message || "PDF could not be generated.");
          return;
        }
      } catch {
        setPdfStatus("failed");
        setPdfError("PDF could not be generated.");
        return;
      }

      if (attempt < PDF_POLL_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, PDF_POLL_INTERVAL_MS));
      }
    }

    setPdfStatus("failed");
    setPdfError("Preparing your illustrated PDF is taking longer than expected. Please try again.");
  }, [requestPdfDownload]);

  const handleDownloadMp3 = useCallback(async () => {
    setIsDownloadingMp3(true);
    setMp3Error(null);

    try {
      const response = await fetch(`/api/download-mp3?token=${encodeURIComponent(accessToken)}`);
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "The narration could not be prepared. Please try again.");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setMp3Error(
        downloadError instanceof Error
          ? downloadError.message
          : "The narration could not be prepared. Please try again.",
      );
    } finally {
      setIsDownloadingMp3(false);
    }
  }, [accessToken]);

  const isPdfBusy = pdfStatus === "preparing_images" || pdfStatus === "generating_pdf";
  const pdfButtonLabel =
    pdfStatus === "preparing_images"
      ? "Preparing illustrations..."
      : pdfStatus === "generating_pdf"
        ? "Creating PDF..."
        : pdfStatus === "failed"
          ? "Try again"
          : "Download PDF";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={isPdfBusy || isDownloadingMp3}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {pdfButtonLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleDownloadMp3()}
          disabled={isPdfBusy || isDownloadingMp3}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {isDownloadingMp3 ? "Preparing narration..." : "Download MP3"}
        </button>
      </div>
      {isPdfBusy ? (
        <p className="mt-2 text-xs text-[#d9bd78]/85">
          Preparing your illustrated PDF... This can take a moment.
        </p>
      ) : null}
      {pdfError ? <p className="mt-2 text-xs text-red-300">{pdfError}</p> : null}
      {mp3Error ? <p className="mt-2 text-xs text-red-300">{mp3Error}</p> : null}
    </div>
  );
}
