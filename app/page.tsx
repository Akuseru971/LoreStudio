"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import ArchiveErrorBoundary from "@/components/ArchiveErrorBoundary";
import IntroCarousel from "@/components/IntroCarousel";
import InteractiveBook from "@/components/InteractiveBook";
import PreviewNotifyModal from "@/components/PreviewNotifyModal";
import SynopsisLoadingScreen from "@/components/SynopsisLoadingScreen";
import MysticalStartTransition from "@/components/MysticalStartTransition";
import ProgressiveLoreForm from "@/components/ProgressiveLoreForm";
import RitualLaunchVideo from "@/components/RitualLaunchVideo";
import RitualVideoPreloader from "@/components/RitualVideoPreloader";
import SynopsisPreview from "@/components/SynopsisPreview";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import {
  getRitualLaunchVideoSrc,
  isRitualLaunchVideoConfigured,
  RITUAL_LAUNCH_VIDEO_POSTER,
} from "@/lib/video-config";
import { fetchBook, fetchBookStatus, generateNextFreeImage, retryMissingImages } from "@/lib/client/api";
import {
  GENERATE_BOOK_FETCH_MS,
  GENERATION_MAX_WAIT_MS,
  GENERATION_POLL_MS,
  GENERATION_PROGRESS_MESSAGES,
  STALE_GENERATION_MS,
  getClientProgressMessage,
  isGenerationPreparing,
  isGenerationStale,
} from "@/lib/generation-progress";
import { normalizeBook } from "@/lib/normalizeBook";
import { safeTrackClient } from "@/lib/safe-analytics-client";
import type { ApprovedSynopsis, BookFormInput, LoreBook } from "@/lib/types";

type AppStep =
  | "intro"
  | "startTransition"
  | "form"
  | "synopsis"
  | "ritualVideo"
  | "creationRitual"
  | "book"
  | "error";

type GenerationStatus = "idle" | "generating" | "ready" | "failed";

const MAX_SYNOPSIS_REGENERATIONS = 3;
const PREVIEW_NOTIFY_MODAL_DELAY_MS = 20_000;

type FreePreviewImageResponse = {
  allFreeImagesReady?: boolean;
  freeIllustrationsReady?: boolean;
  freePreviewReady?: boolean;
  previewReady?: boolean;
  previewCoverReady?: boolean;
  readyPreviewAssetsCount?: number;
  missingFreePages?: number[];
  readyFreeImageCount?: number;
  pageNumber?: number | null;
  skipped?: boolean;
  reason?: string;
  retryable?: boolean;
  error?: string;
};

type BookStatusResponse = {
  generationStatus?: string;
  generationError?: string;
  generationUpdatedAt?: string;
  progressMessage?: string;
  status?: string;
  freeIllustrationsReady?: boolean;
  freePreviewReady?: boolean;
  previewReady?: boolean;
  previewCoverReady?: boolean;
  readyPreviewAssetsCount?: number;
  readyFreeImageCount?: number;
  previewNotifyRequested?: boolean;
};

function shouldStopFreePreviewLoop(data: FreePreviewImageResponse | null | undefined) {
  if (!data) {
    return false;
  }

  return Boolean(data.allFreeImagesReady || data.freePreviewReady || data.freeIllustrationsReady || (data.readyPreviewAssetsCount ?? data.readyFreeImageCount ?? 0) >= 3);
}

function isFreePreviewPageReady(data: FreePreviewImageResponse | null | undefined, pageNumber: number) {
  if (!data) {
    return false;
  }

  if (shouldStopFreePreviewLoop(data)) {
    return true;
  }

  if (data.skipped && data.reason === "page_already_ready" && data.pageNumber === pageNumber) {
    return true;
  }

  return !data.missingFreePages?.includes(pageNumber);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      response.ok
        ? "The archives answered in an unreadable language. Try again."
        : "The archive server failed to answer. Please redeploy or try again.",
    );
  }
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("intro");
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [book, setBook] = useState<LoreBook | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [formInput, setFormInput] = useState<BookFormInput | null>(null);
  const [approvedSynopsis, setApprovedSynopsis] = useState<ApprovedSynopsis | null>(null);
  const [synopsisLoading, setSynopsisLoading] = useState(false);
  const [synopsisError, setSynopsisError] = useState<string | null>(null);
  const [synopsisRegenerationCount, setSynopsisRegenerationCount] = useState(0);
  const [generationError, setGenerationError] = useState("The archives refused to open. Try again.");
  const [generationProgressMessage, setGenerationProgressMessage] = useState<string>(
    GENERATION_PROGRESS_MESSAGES.writing,
  );
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [videoFinished, setVideoFinished] = useState(false);
  const [bookIsOpen, setBookIsOpen] = useState(false);
  const [showPreviewNotifyModal, setShowPreviewNotifyModal] = useState(false);

  const generationRunRef = useRef(0);
  const generationStartedRef = useRef(false);
  const generationPromiseRef = useRef<Promise<void> | null>(null);
  const freePreviewGenerationInFlightRef = useRef<Promise<void> | null>(null);
  const freePreviewParallelStartedRunRef = useRef<number | null>(null);
  const previewNotifyHandledRunRef = useRef<number | null>(null);
  const synopsisRequestRef = useRef(0);
  const introVideoSrc = getRitualLaunchVideoSrc();
  const hasIntroVideo = isRitualLaunchVideoConfigured() && Boolean(introVideoSrc);
  const shouldPlayAmbientMusic =
    (step === "form" || step === "synopsis" || (step === "book" && bookIsOpen)) && !ambientMuted;
  const ambientMusicVolume = step === "form" || step === "synopsis" ? 0.14 : 0.12;
  const isGenerating = generationStatus === "generating";

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  useEffect(() => {
    if (generationStatus !== "ready" || !book || !accessToken || !videoFinished) {
      return;
    }

    if (step === "ritualVideo" || step === "creationRitual") {
      setStep("book");
    }
  }, [accessToken, book, generationStatus, step, videoFinished]);

  useEffect(() => {
    if (generationStatus !== "failed" || !videoFinished) {
      return;
    }

    if (step === "ritualVideo" || step === "creationRitual") {
      setStep("error");
    }
  }, [generationStatus, step, videoFinished]);

  useEffect(() => {
    if (step !== "creationRitual" || generationStatus !== "generating" || !accessToken) {
      setShowPreviewNotifyModal(false);
      return;
    }

    const runId = generationRunRef.current;
    if (previewNotifyHandledRunRef.current === runId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (generationRunRef.current === runId && previewNotifyHandledRunRef.current !== runId) {
        setShowPreviewNotifyModal(true);
      }
    }, PREVIEW_NOTIFY_MODAL_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, generationStatus, step]);

  const fetchSynopsis = useCallback(async (input: BookFormInput, regenerationAttempt = 0) => {
    synopsisRequestRef.current += 1;
    const requestId = synopsisRequestRef.current;

    setSynopsisLoading(true);
    setSynopsisError(null);

    try {
      const response = await fetch("/api/generate-synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          regenerationAttempt,
        }),
      });

      const data = await readJsonResponse<ApprovedSynopsis & { error?: string }>(response);

      if (synopsisRequestRef.current !== requestId) {
        return;
      }

      if (!response.ok || !data.synopsis) {
        throw new Error(data.error || "The first omen could not be opened. Try again.");
      }

      setApprovedSynopsis(data);
    } catch (error) {
      if (synopsisRequestRef.current !== requestId) {
        return;
      }

      setSynopsisError(error instanceof Error ? error.message : "The first omen could not be opened. Try again.");
      setApprovedSynopsis(null);
    } finally {
      if (synopsisRequestRef.current === requestId) {
        setSynopsisLoading(false);
      }
    }
  }, []);

  async function runFreePreviewImageGeneration(token: string, runId: number) {
    while (generationRunRef.current === runId) {
      const { response, data } = await generateNextFreeImage(token, 1);
      const previewData = data as FreePreviewImageResponse;

      if (shouldStopFreePreviewLoop(previewData)) {
        console.log("[FREE_PREVIEW_LOOP_STOP_ALL_READY]");
        return;
      }

      if (!response.ok && !previewData.retryable) {
        console.warn("[FREE_IMAGE_WORKER_ERROR]", previewData.error);
        await sleep(GENERATION_POLL_MS);
        continue;
      }

      if (isFreePreviewPageReady(previewData, 1)) {
        break;
      }

      await sleep(500);
    }

    if (freePreviewParallelStartedRunRef.current === runId) {
      while (generationRunRef.current === runId) {
        const { response, data } = await fetchBookStatus(token);
        if (response.ok && (data.freePreviewReady || data.freeIllustrationsReady || data.allFreeImagesReady || (data.readyPreviewAssetsCount ?? data.readyFreeImageCount ?? 0) >= 3)) {
          console.log("[FREE_PREVIEW_LOOP_STOP_ALL_READY]");
          return;
        }

        await sleep(GENERATION_POLL_MS);
      }

      return;
    }

    freePreviewParallelStartedRunRef.current = runId;

    await Promise.allSettled([
      generateNextFreeImage(token, { pageNumber: 2 }),
      generateNextFreeImage(token, { previewCover: true }),
    ]);

    while (generationRunRef.current === runId) {
      const { response, data } = await fetchBookStatus(token);
      if (response.ok && (data.freePreviewReady || data.freeIllustrationsReady || data.allFreeImagesReady || (data.readyPreviewAssetsCount ?? data.readyFreeImageCount ?? 0) >= 3)) {
        console.log("[FREE_PREVIEW_LOOP_STOP_ALL_READY]");
        return;
      }

      await sleep(GENERATION_POLL_MS);
    }
  }

  function kickFreePreviewImageGeneration(token: string, runId: number) {
    if (freePreviewGenerationInFlightRef.current) {
      return;
    }

    const task = runFreePreviewImageGeneration(token, runId).finally(() => {
      if (freePreviewGenerationInFlightRef.current === task) {
        freePreviewGenerationInFlightRef.current = null;
      }
    });

    freePreviewGenerationInFlightRef.current = task;
  }

  async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const data = await readJsonResponse<T>(response);
      return { response, data };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function runGeneration(input: BookFormInput, synopsis: ApprovedSynopsis | null, runId: number) {
    console.log("[GENERATION_REQUEST_STARTED]", Date.now());
    const startedAt = Date.now();
    setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES.writing);

    let accessToken: string;

    try {
      const { response, data } = await fetchJsonWithTimeout<{
        book?: LoreBook;
        accessToken?: string;
        error?: string;
        debug?: { name?: string };
      }>(
        "/api/generate-book",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formInput: input,
            approvedSynopsis: synopsis,
          }),
        },
        GENERATE_BOOK_FETCH_MS,
      );

      if (!response.ok || !data.book || !data.accessToken) {
        const detail = data.error || data.debug?.name;
        throw new Error(detail || "The archives refused to open. Try again.");
      }

      const initialBook = normalizeBook(data.book);
      if (!initialBook) {
        throw new Error("The generated book could not be prepared for reading.");
      }

      accessToken = data.accessToken;

      if (generationRunRef.current !== runId) {
        return;
      }

      setAccessToken(accessToken);
      setBook(initialBook);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The chronicle is still being prepared. Please keep this page open.");
      }

      throw error;
    }

    const kickImageWorkers = () => {
      kickFreePreviewImageGeneration(accessToken, runId);
    };

    kickImageWorkers();

    while (generationRunRef.current === runId && Date.now() - startedAt < GENERATION_MAX_WAIT_MS) {
      const elapsedMs = Date.now() - startedAt;
      const { response: statusResponse, data: statusData } = await fetchBookStatus(accessToken);

      if (statusResponse.ok) {
        const status = statusData as BookStatusResponse;
        const readyPreviewAssetsCount = Number(status.readyPreviewAssetsCount ?? status.readyFreeImageCount ?? 0);
        const hasText = status.generationStatus !== "generating_text";
        const freePreviewReady = Boolean(status.freePreviewReady || status.previewReady || status.freeIllustrationsReady);

        setGenerationProgressMessage(
          (status.progressMessage as string | undefined) ||
            getClientProgressMessage({
              elapsedMs,
              hasText,
              readyFreeImageCount: readyPreviewAssetsCount,
            }),
        );

        if (status.previewNotifyRequested) {
          previewNotifyHandledRunRef.current = runId;
          setShowPreviewNotifyModal(false);
        }

        if (status.status === "failed" || status.generationStatus === "failed") {
          throw new Error(
            (status.generationError as string | undefined) || "The archives refused to open. Try again.",
          );
        }

        if (freePreviewReady) {
          const { response: bookResponse, data: bookData } = await fetchBook(accessToken);
          if (bookResponse.ok && bookData.book) {
            const finalBook = normalizeBook(bookData.book);
            if (finalBook && generationRunRef.current === runId) {
              console.log("[GENERATION_REQUEST_FINISHED]", Date.now());
              setBook(finalBook);
              setGenerationStatus("ready");
              safeTrackClient("book_created", { source: "form" });
              return;
            }
          }
        }

        const updatedAt = status.generationUpdatedAt;
        if (isGenerationPreparing(status.generationStatus as string) && isGenerationStale(updatedAt, STALE_GENERATION_MS)) {
          void retryMissingImages(accessToken);
        }

        if (!freePreviewReady) {
          kickImageWorkers();
        }
      }

      await sleep(GENERATION_POLL_MS);
    }

    const { response: bookResponse, data: bookData } = await fetchBook(accessToken);
    if (bookResponse.ok && bookData.book) {
      const finalBook = normalizeBook(bookData.book);
      if (finalBook && generationRunRef.current === runId) {
        console.log("[GENERATION_REQUEST_FINISHED_PARTIAL]", Date.now());
        setBook(finalBook);
        setGenerationStatus("ready");
        safeTrackClient("book_created", { source: "form" });
        return;
      }
    }

    throw new Error("The chronicle could not be completed. Please try again.");
  }

  function handleFormSubmit(input: BookFormInput) {
    if (synopsisLoading || isGenerating) {
      return;
    }

    setFormInput(input);
    setApprovedSynopsis(null);
    setSynopsisRegenerationCount(0);
    setSynopsisError(null);
    setStep("synopsis");
    void fetchSynopsis(input, 0);
  }

  function handleCreateLegend() {
    if (generationStartedRef.current) {
      return;
    }

    if (!formInput || !approvedSynopsis || generationStatus === "generating") {
      return;
    }

    generationStartedRef.current = true;
    console.log("[CREATE_LEGEND_CLICK]", Date.now());
    safeTrackClient("book_creation_started", { source: "homepage" });

    generationRunRef.current += 1;
    const runId = generationRunRef.current;
    freePreviewParallelStartedRunRef.current = null;

    setBook(null);
    setAccessToken(null);
    setGenerationStatus("generating");
    setGenerationError("The archives refused to open. Try again.");
    setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES.writing);
    setVideoFinished(false);
    setBookIsOpen(false);

    const generationPromise = runGeneration(formInput, approvedSynopsis, runId).catch((error) => {
      if (generationRunRef.current !== runId) {
        return;
      }

      console.error("[GENERATION_REQUEST_FAILED]", error);
      setGenerationError(error instanceof Error ? error.message : "The archives refused to open. Try again.");
      setGenerationStatus("failed");
    });

    generationPromiseRef.current = generationPromise;

    if (hasIntroVideo) {
      console.log("[VIDEO_STEP_STARTED]", Date.now());
      setStep("ritualVideo");
      return;
    }

    setVideoFinished(true);
    setStep("creationRitual");
  }

  function handleTryAnotherDirection() {
    if (!formInput || synopsisRegenerationCount >= MAX_SYNOPSIS_REGENERATIONS || synopsisLoading) {
      return;
    }

    const nextAttempt = synopsisRegenerationCount + 1;
    setSynopsisRegenerationCount(nextAttempt);
    void fetchSynopsis(formInput, nextAttempt);
  }

  function handleEditAnswers() {
    setApprovedSynopsis(null);
    setSynopsisError(null);
    setSynopsisRegenerationCount(0);
    setStep("form");
  }

  function handleVideoEnded() {
    console.log("[VIDEO_ENDED]", Date.now());
    setVideoFinished(true);

    if (generationStatus === "ready" && book && accessToken) {
      setStep("book");
      return;
    }

    if (generationStatus === "failed") {
      setStep("error");
      return;
    }

    setStep("creationRitual");
  }

  function handleVideoSkipped() {
    console.log("[VIDEO_SKIPPED]", Date.now());
    setVideoFinished(true);

    if (generationStatus === "ready" && book && accessToken) {
      setStep("book");
      return;
    }

    if (generationStatus === "failed") {
      setStep("error");
      return;
    }

    setStep("creationRitual");
  }

  function reset() {
    generationStartedRef.current = false;
    generationRunRef.current += 1;
    freePreviewParallelStartedRunRef.current = null;
    previewNotifyHandledRunRef.current = null;
    synopsisRequestRef.current += 1;
    setShowPreviewNotifyModal(false);
    setBook(null);
    setAccessToken(null);
    setFormInput(null);
    setApprovedSynopsis(null);
    setSynopsisError(null);
    setSynopsisRegenerationCount(0);
    setGenerationStatus("idle");
    setGenerationError("The archives refused to open. Try again.");
    setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES.writing);
    setVideoFinished(false);
    setBookIsOpen(false);
    setStep("form");
  }

  return (
    <>
      <AmbientMusicPlayer shouldPlay={shouldPlayAmbientMusic} normalVolume={ambientMusicVolume} />
      {step === "form" ? <RitualVideoPreloader /> : null}

      <AnimatePresence>
        {step === "intro" ? (
          <motion.div key="intro" exit={{ opacity: 0, filter: "blur(18px)" }} transition={{ duration: 0.7 }}>
            <IntroCarousel onBegin={() => setStep("form")} />
          </motion.div>
        ) : null}

        {step === "startTransition" ? (
          <motion.div key="startTransition" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.45 }}>
            <MysticalStartTransition onComplete={() => setStep("form")} />
          </motion.div>
        ) : null}

        {step === "form" ? (
          <motion.div key="form" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.35 }}>
            <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
            <ProgressiveLoreForm onSubmit={handleFormSubmit} disabled={synopsisLoading || isGenerating} />
          </motion.div>
        ) : null}

        {step === "synopsis" ? (
          <motion.div key="synopsis" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.35 }}>
            <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
            <ArchiveErrorBoundary onReset={handleEditAnswers} resetLabel="Edit answers">
              <SynopsisPreview
              synopsis={approvedSynopsis}
              isLoading={synopsisLoading}
              error={synopsisError}
              regenerationLimitReached={synopsisRegenerationCount >= MAX_SYNOPSIS_REGENERATIONS}
              onCreateLegend={handleCreateLegend}
              onTryAnotherDirection={handleTryAnotherDirection}
              onEditAnswers={handleEditAnswers}
              onRetry={() => {
                if (formInput) {
                  void fetchSynopsis(formInput, synopsisRegenerationCount);
                }
              }}
              isCreating={isGenerating}
            />
            </ArchiveErrorBoundary>
          </motion.div>
        ) : null}

        {step === "book" ? (
          <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
        ) : null}

        {step === "ritualVideo" && introVideoSrc ? (
          <motion.div key="ritualVideo" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <RitualLaunchVideo
              src={introVideoSrc}
              poster={RITUAL_LAUNCH_VIDEO_POSTER}
              onEnded={handleVideoEnded}
              onSkip={handleVideoSkipped}
            />
          </motion.div>
        ) : null}

        {step === "creationRitual" ? (
          <motion.div key="creationRitual" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <SynopsisLoadingScreen
              synopsis={approvedSynopsis}
              formInput={formInput}
              loadingMessage={generationProgressMessage}
            />
          </motion.div>
        ) : null}

        {step === "creationRitual" && accessToken ? (
          <PreviewNotifyModal
            accessToken={accessToken}
            isOpen={showPreviewNotifyModal}
            onClose={() => setShowPreviewNotifyModal(false)}
            onDismiss={() => {
              previewNotifyHandledRunRef.current = generationRunRef.current;
              setShowPreviewNotifyModal(false);
            }}
            onNotifyRequested={() => {
              previewNotifyHandledRunRef.current = generationRunRef.current;
              safeTrackClient("preview_notify_requested", { source: "loading" });
            }}
          />
        ) : null}

        {step === "book" && book && accessToken ? (
          <motion.div key="book" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <ArchiveErrorBoundary onReset={reset}>
              <InteractiveBook
                book={book}
                accessToken={accessToken}
                onReset={reset}
                onReadingStateChange={setBookIsOpen}
              />
            </ArchiveErrorBoundary>
          </motion.div>
        ) : null}

        {step === "error" ? (
          <motion.main
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="archive-shell flex min-h-screen items-center justify-center px-5"
          >
            <section className="glass-panel relative z-10 max-w-xl rounded-[2rem] p-8 text-center">
              <p className="font-title text-xs uppercase tracking-[0.36em] text-[#d9bd78]">The seal did not break</p>
              <h1 className="font-title mt-4 text-4xl text-[#f7ebce]">The archives refused to open.</h1>
              <p className="mt-4 text-sm leading-7 text-[#9baabd]">{generationError}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={reset}
                  className="gold-button rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
                >
                  Try again
                </button>
              </div>
            </section>
          </motion.main>
        ) : null}
      </AnimatePresence>
    </>
  );
}
