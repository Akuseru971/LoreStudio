"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getImageForPage, isIllustrationReady, logPdfReadyCheck } from "@/lib/book-images";
import {
  getPdfButtonLabel,
  getPdfStatusMessage,
  isPdfDownloadReady,
  resolvePdfAvailability,
} from "@/lib/pdfReadiness";
import type { PageImageState, PdfStatus } from "@/lib/types";

type BookPremiumActionsProps = {
  accessToken: string;
  isPremium?: boolean;
  className?: string;
};

type BookStatusResponse = {
  isPremium?: boolean;
  images?: Record<string, PageImageState>;
  imageStatus?: Record<string, PageImageState>;
  illustrationsReadyCount?: number;
  readyIllustrationCount?: number;
  allIllustrationsReady?: boolean;
  hasFailedIllustrations?: boolean;
  pdfStatus?: PdfStatus;
  error?: string;
};

type PdfDownloadResponse = {
  status?: "ready" | "not_ready" | "generating_pdf" | "failed";
  downloadUrl?: string;
  message?: string;
  reason?: string;
};

const STATUS_POLL_INTERVAL_MS = 4000;

export default function BookPremiumActions({
  accessToken,
  isPremium: isPremiumProp = true,
  className,
}: BookPremiumActionsProps) {
  const [imageStatus, setImageStatus] = useState<Record<string, PageImageState>>({});
  const [illustrationsReadyCount, setIllustrationsReadyCount] = useState(0);
  const [isPremium, setIsPremium] = useState(isPremiumProp);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("not_started");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [isRetryingIllustrations, setIsRetryingIllustrations] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mp3Error, setMp3Error] = useState<string | null>(null);

  const statusPollRef = useRef(0);
  const pollIntervalRef = useRef<number | null>(null);
  const premiumGenerationStartedRef = useRef(false);

  const pdfAvailability = resolvePdfAvailability({
    isPremium,
    images: imageStatus,
    pdfStatus,
    isDownloadingPdf,
  });

  const isPdfReady = isPdfDownloadReady(pdfAvailability);
  const pdfButtonLabel = getPdfButtonLabel(pdfAvailability);
  const pdfStatusMessage = getPdfStatusMessage(pdfAvailability);

  const refreshBookStatus = useCallback(async () => {
    const response = await fetch(`/api/book-status?token=${encodeURIComponent(accessToken)}`);
    const data = (await response.json()) as BookStatusResponse;

    if (!response.ok) {
      throw new Error(data.error || "Unable to load book status.");
    }

    const normalizedImages = data.images || data.imageStatus || {};
    const readyCount = data.readyIllustrationCount ?? data.illustrationsReadyCount ?? 0;

    setIsPremium(Boolean(data.isPremium));
    setImageStatus(normalizedImages);
    setIllustrationsReadyCount(readyCount);
    setPdfStatus(data.pdfStatus || "not_started");

    console.log("[PDF_READY_CHECK] images:", normalizedImages);
    for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
      const image = getImageForPage({ images: normalizedImages }, pageNumber);
      console.log("[PDF_READY_CHECK_PAGE]", {
        pageNumber,
        image,
        status: image?.status,
        url: image?.url,
        src: image?.src,
        imageUrl: image?.imageUrl,
        storagePath: image?.storagePath,
        isReady: isIllustrationReady(image),
      });
    }

    logPdfReadyCheck({ images: normalizedImages }, "client");

    return { ...data, images: normalizedImages, readyIllustrationCount: readyCount };
  }, [accessToken]);

  const ensurePremiumImagesStarted = useCallback(async () => {
    if (premiumGenerationStartedRef.current) {
      return;
    }

    premiumGenerationStartedRef.current = true;

    await fetch("/api/generate-premium-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
  }, [accessToken]);

  useEffect(() => {
    statusPollRef.current += 1;
    const pollId = statusPollRef.current;
    let cancelled = false;

    async function pollStatus() {
      try {
        const data = await refreshBookStatus();
        if (cancelled || statusPollRef.current !== pollId) {
          return;
        }

        if (data.isPremium && !data.allIllustrationsReady) {
          await ensurePremiumImagesStarted();
        }

        if (data.allIllustrationsReady && pollIntervalRef.current !== null) {
          window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch {
        if (!cancelled) {
          setPdfError("Unable to check illustration status.");
        }
      }
    }

    void pollStatus();

    pollIntervalRef.current = window.setInterval(() => {
      void pollStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      statusPollRef.current += 1;
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [accessToken, ensurePremiumImagesStarted, refreshBookStatus]);

  const handleRetryIllustrations = useCallback(async () => {
    setIsRetryingIllustrations(true);
    setPdfError(null);

    try {
      await fetch("/api/retry-missing-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      await refreshBookStatus();
    } catch {
      setPdfError("Unable to retry illustration generation.");
    } finally {
      setIsRetryingIllustrations(false);
    }
  }, [accessToken, refreshBookStatus]);

  const handleDownloadPdf = useCallback(async () => {
    if (!isPdfReady) {
      return;
    }

    setIsDownloadingPdf(true);
    setPdfError(null);

    try {
      const response = await fetch(`/api/download-pdf?token=${encodeURIComponent(accessToken)}`);
      const data = (await response.json()) as PdfDownloadResponse;

      if (data.status === "ready" && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (data.status === "not_ready") {
        await refreshBookStatus();
        return;
      }

      if (data.status === "generating_pdf") {
        setPdfStatus("generating");
        return;
      }

      setPdfError(data.message || "PDF could not be generated.");
    } catch {
      setPdfError("PDF could not be generated.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [accessToken, isPdfReady, refreshBookStatus]);

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

  const showRetryIllustrations =
    pdfAvailability === "illustrations_failed" ||
    (isPremium && illustrationsReadyCount < FULL_BOOK_PAGE_COUNT && pdfAvailability === "waiting_for_illustrations");
  const isPdfButtonDisabled =
    !isPdfReady || isDownloadingPdf || isDownloadingMp3 || isRetryingIllustrations;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={isPdfButtonDisabled}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pdfButtonLabel}
        </button>
        {showRetryIllustrations ? (
          <button
            type="button"
            onClick={() => void handleRetryIllustrations()}
            disabled={isRetryingIllustrations || isDownloadingMp3}
            className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
          >
            {isRetryingIllustrations ? "Retrying illustrations..." : "Retry missing illustrations"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleDownloadMp3()}
          disabled={isDownloadingPdf || isDownloadingMp3 || isRetryingIllustrations}
          className="rounded-full border border-[#d9bd78]/35 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {isDownloadingMp3 ? "Preparing narration..." : "Download MP3"}
        </button>
      </div>

      {isPremium ? (
        <p className="mt-2 text-xs text-[#d9bd78]/85">
          Illustrations ready: {illustrationsReadyCount}/{FULL_BOOK_PAGE_COUNT}
        </p>
      ) : null}

      <p className="mt-1 text-xs text-[#9baabd]">{pdfStatusMessage}</p>

      {pdfError ? <p className="mt-2 text-xs text-red-300">{pdfError}</p> : null}
      {mp3Error ? <p className="mt-2 text-xs text-red-300">{mp3Error}</p> : null}
    </div>
  );
}
