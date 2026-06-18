"use client";

import { useCallback, useState } from "react";

type BookPremiumActionsProps = {
  accessToken: string;
  className?: string;
};

export default function BookPremiumActions({ accessToken, className }: BookPremiumActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/download-pdf?token=${encodeURIComponent(accessToken)}`);
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to download the PDF.");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the PDF.");
    } finally {
      setIsDownloading(false);
    }
  }, [accessToken]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleDownloadPdf()}
        disabled={isDownloading}
        className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
      >
        {isDownloading ? "Preparing PDF..." : "Download PDF"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
