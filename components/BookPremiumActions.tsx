"use client";

import { useCallback, useState } from "react";

type BookPremiumActionsProps = {
  accessToken: string;
  className?: string;
};

export default function BookPremiumActions({ accessToken, className }: BookPremiumActionsProps) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mp3Error, setMp3Error] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloadingPdf(true);
    setPdfError(null);

    try {
      const maxAttempts = 40;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(`/api/download-pdf?token=${encodeURIComponent(accessToken)}`);
        const data = (await response.json()) as { url?: string; error?: string };

        if (response.ok && data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
          return;
        }

        if (response.status === 409) {
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
          continue;
        }

        throw new Error(data.error || "Unable to download the PDF.");
      }

      throw new Error("Preparing your illustrated PDF... Please try again in a moment.");
    } catch (downloadError) {
      setPdfError(downloadError instanceof Error ? downloadError.message : "Unable to download the PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [accessToken]);

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

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={isDownloadingPdf || isDownloadingMp3}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {isDownloadingPdf ? "Preparing your illustrated PDF..." : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => void handleDownloadMp3()}
          disabled={isDownloadingPdf || isDownloadingMp3}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {isDownloadingMp3 ? "Preparing narration..." : "Download MP3"}
        </button>
      </div>
      {pdfError ? <p className="mt-2 text-xs text-red-300">{pdfError}</p> : null}
      {mp3Error ? <p className="mt-2 text-xs text-red-300">{mp3Error}</p> : null}
    </div>
  );
}
