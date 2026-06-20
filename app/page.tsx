"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import IntroGate from "@/components/IntroGate";
import InteractiveBook from "@/components/InteractiveBook";
import LoadingRitual from "@/components/LoadingRitual";
import MysticalStartTransition from "@/components/MysticalStartTransition";
import ProgressiveLoreForm from "@/components/ProgressiveLoreForm";
import RitualLaunchVideo from "@/components/RitualLaunchVideo";
import RitualVideoPreloader from "@/components/RitualVideoPreloader";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { buildPageNarrationText } from "@/lib/bookNarration";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import {
  getRitualLaunchVideoSrc,
  isRitualLaunchVideoConfigured,
  RITUAL_LAUNCH_VIDEO_POSTER,
} from "@/lib/video-config";
import type { BookFormInput, LoreBook } from "@/lib/types";

type AppStep =
  | "intro"
  | "startTransition"
  | "form"
  | "ritualVideo"
  | "creationRitual"
  | "book"
  | "error";

type GenerationStatus = "idle" | "generating" | "ready" | "failed";

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

async function generateAudioForPage(page: LoreBook["pages"][number]) {
  const response = await fetch("/api/generate-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: buildPageNarrationText(page), pageNumber: page.pageNumber }),
  });

  const data = await readJsonResponse<{ audioUrl?: string | null }>(response);
  return data.audioUrl || null;
}

async function attachInitialAudio(book: LoreBook) {
  const pages = book.pages.map((page) => ({ ...page }));
  const audioPages = pages.slice(0, ILLUSTRATED_PAGE_COUNT);
  const audioResults = await Promise.allSettled(audioPages.map((page) => generateAudioForPage(page)));

  audioResults.forEach((result, index) => {
    pages[index] = {
      ...pages[index],
      audioUrl: result.status === "fulfilled" ? result.value : null,
    };
  });

  return {
    ...book,
    pages,
  };
}

async function uploadBookAsset(
  accessToken: string,
  pageNumber: number,
  assetType: "image" | "audio",
  assetRef: string,
) {
  const response = await fetch("/api/books/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, pageNumber, assetType, assetRef }),
  });

  const data = await readJsonResponse<{ ok?: boolean; error?: string }>(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "The book assets could not be saved.");
  }
}

async function persistInitialAudio(accessToken: string, book: LoreBook) {
  const uploads: Promise<void>[] = [];

  for (const page of book.pages.slice(0, ILLUSTRATED_PAGE_COUNT)) {
    if (page.audioUrl) {
      uploads.push(uploadBookAsset(accessToken, page.pageNumber, "audio", page.audioUrl));
    }
  }

  await Promise.all(uploads);
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("intro");
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [book, setBook] = useState<LoreBook | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("The archives refused to open. Try again.");
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [videoFinished, setVideoFinished] = useState(false);
  const [bookIsOpen, setBookIsOpen] = useState(false);

  const generationRunRef = useRef(0);
  const generationPromiseRef = useRef<Promise<void> | null>(null);
  const introVideoSrc = getRitualLaunchVideoSrc();
  const hasIntroVideo = isRitualLaunchVideoConfigured() && Boolean(introVideoSrc);
  const shouldPlayAmbientMusic = (step === "form" || (step === "book" && bookIsOpen)) && !ambientMuted;
  const ambientMusicVolume = step === "form" ? 0.14 : 0.12;
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

  async function runGeneration(input: BookFormInput, runId: number) {
    console.log("[GENERATION_REQUEST_STARTED]", Date.now());

    const response = await fetch("/api/generate-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await readJsonResponse<{
      book?: LoreBook;
      accessToken?: string;
      error?: string;
      debug?: { name?: string };
    }>(response);

    if (!response.ok || !data.book || !data.accessToken) {
      const detail = data.error || data.debug?.name;
      throw new Error(detail || "The archives refused to open. Try again.");
    }

    if (generationRunRef.current !== runId) {
      return;
    }

    console.log("[GENERATION_REQUEST_FINISHED]", Date.now());

    const preparedBook = await attachInitialAudio(data.book);

    if (generationRunRef.current !== runId) {
      return;
    }

    await persistInitialAudio(data.accessToken, preparedBook);

    if (generationRunRef.current !== runId) {
      return;
    }

    setBook(preparedBook);
    setAccessToken(data.accessToken);
    setGenerationStatus("ready");
  }

  function handleSubmit(input: BookFormInput) {
    if (generationStatus === "generating") {
      return;
    }

    console.log("[GENERATE_CLICK]", Date.now());

    generationRunRef.current += 1;
    const runId = generationRunRef.current;

    setBook(null);
    setAccessToken(null);
    setGenerationStatus("generating");
    setGenerationError("The archives refused to open. Try again.");
    setVideoFinished(false);
    setBookIsOpen(false);

    const generationPromise = runGeneration(input, runId).catch((error) => {
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
    generationRunRef.current += 1;
    setBook(null);
    setAccessToken(null);
    setGenerationStatus("idle");
    setGenerationError("The archives refused to open. Try again.");
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
            <IntroGate onStart={() => setStep("startTransition")} />
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
            <ProgressiveLoreForm onSubmit={handleSubmit} disabled={isGenerating} />
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
            <LoadingRitual />
          </motion.div>
        ) : null}

        {step === "book" && book && accessToken ? (
          <motion.div key="book" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <InteractiveBook
              book={book}
              accessToken={accessToken}
              onReset={reset}
              onReadingStateChange={setBookIsOpen}
            />
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
