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
import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
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
import { stripBookAssets } from "@/lib/utils";

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

async function generateImageForPage(book: LoreBook, pageNumber: number) {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book, pageNumber }),
  });

  const data = await readJsonResponse<{ imageUrl?: string | null }>(response);
  return data.imageUrl || undefined;
}

async function generateAudioForPage(page: LoreBook["pages"][number]) {
  const response = await fetch("/api/generate-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: page.text, pageNumber: page.pageNumber }),
  });

  const data = await readJsonResponse<{ audioUrl?: string | null }>(response);
  return data.audioUrl || null;
}

async function attachInitialAssets(book: LoreBook) {
  const pages = [...book.pages];
  const imagePages = pages.slice(0, FREE_IMAGE_PAGE_COUNT);
  const audioPages = pages.slice(0, ILLUSTRATED_PAGE_COUNT);

  const [imageResults, audioResults] = await Promise.all([
    Promise.allSettled(imagePages.map((page) => generateImageForPage(book, page.pageNumber))),
    Promise.allSettled(audioPages.map((page) => generateAudioForPage(page))),
  ]);

  imageResults.forEach((result, index) => {
    pages[index] = {
      ...pages[index],
      imageUrl: result.status === "fulfilled" ? result.value : undefined,
    };
  });

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

async function persistInitialAssets(accessToken: string, book: LoreBook) {
  const uploads: Promise<void>[] = [];

  for (const page of book.pages.slice(0, FREE_IMAGE_PAGE_COUNT)) {
    if (page.imageUrl) {
      uploads.push(uploadBookAsset(accessToken, page.pageNumber, "image", page.imageUrl));
    }
  }

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
  const introVideoSrc = getRitualLaunchVideoSrc();
  const hasIntroVideo = isRitualLaunchVideoConfigured() && Boolean(introVideoSrc);
  const shouldPlayAmbientMusic = (step === "form" || (step === "book" && bookIsOpen)) && !ambientMuted;
  const ambientMusicVolume = step === "form" ? 0.14 : 0.12;
  const isGenerating = generationStatus === "generating";

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  useEffect(() => {
    if (step === "ritualVideo") {
      console.log("[VIDEO] Started at", Date.now());
    }
  }, [step]);

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
    const response = await fetch("/api/generate-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await readJsonResponse<{ book?: LoreBook; error?: string }>(response);
    if (!response.ok || !data.book) {
      throw new Error(data.error || "The archives refused to open. Try again.");
    }

    if (generationRunRef.current !== runId) {
      return;
    }

    const preparedBook = await attachInitialAssets(data.book);

    if (generationRunRef.current !== runId) {
      return;
    }

    const saveResponse = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, book: stripBookAssets(preparedBook) }),
    });
    const saveData = await readJsonResponse<{ accessToken?: string; error?: string }>(saveResponse);
    if (!saveResponse.ok || !saveData.accessToken) {
      throw new Error(saveData.error || "The book could not be saved.");
    }

    if (generationRunRef.current !== runId) {
      return;
    }

    await persistInitialAssets(saveData.accessToken, preparedBook);

    if (generationRunRef.current !== runId) {
      return;
    }

    setBook(preparedBook);
    setAccessToken(saveData.accessToken);
    setGenerationStatus("ready");
    console.log("[GENERATION] Finished at", Date.now());
  }

  function handleSubmit(input: BookFormInput) {
    if (generationStatus === "generating") {
      return;
    }

    generationRunRef.current += 1;
    const runId = generationRunRef.current;

    console.log("[GENERATION] Started at", Date.now());

    setBook(null);
    setAccessToken(null);
    setGenerationStatus("generating");
    setGenerationError("The archives refused to open. Try again.");
    setVideoFinished(false);
    setBookIsOpen(false);

    void runGeneration(input, runId).catch((error) => {
      if (generationRunRef.current !== runId) {
        return;
      }

      setGenerationError(error instanceof Error ? error.message : "The archives refused to open. Try again.");
      setGenerationStatus("failed");
      console.log("[GENERATION] Failed at", Date.now());
    });

    if (hasIntroVideo) {
      setStep("ritualVideo");
      return;
    }

    setVideoFinished(true);
    setStep("creationRitual");
  }

  function handleVideoEnded() {
    console.log("[VIDEO] Ended at", Date.now());
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
    console.log("[VIDEO] Skipped at", Date.now());
    handleVideoEnded();
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
