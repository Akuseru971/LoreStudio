"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import CreationRitual from "@/components/CreationRitual";
import IntroGate from "@/components/IntroGate";
import InteractiveBook from "@/components/InteractiveBook";
import LegendRevealSequence from "@/components/LegendRevealSequence";
import MysticalStartTransition from "@/components/MysticalStartTransition";
import ProgressiveLoreForm from "@/components/ProgressiveLoreForm";
import RitualLaunchVideo from "@/components/RitualLaunchVideo";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import {
  computeRitualPhase,
  computeTargetProgress,
  createInitialRitualStatus,
  pickDefaultQuote,
  pickDefaultRelic,
  type RitualStatus,
} from "@/lib/ritual";
import {
  getRitualLaunchVideoSrc,
  isRitualLaunchVideoConfigured,
  prefetchRitualLaunchVideo,
  RITUAL_LAUNCH_VIDEO_POSTER,
} from "@/lib/video-config";
import type { BookFormInput, LoreBook } from "@/lib/types";

type AppStep =
  | "intro"
  | "startTransition"
  | "form"
  | "ritualVideo"
  | "creationRitual"
  | "legendReveal"
  | "book"
  | "error";

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

const BINDING_DURATION_MS = 4800;

export default function Home() {
  const [step, setStep] = useState<AppStep>("intro");
  const [book, setBook] = useState<LoreBook | null>(null);
  const [formInput, setFormInput] = useState<BookFormInput | null>(null);
  const [ritualBook, setRitualBook] = useState<LoreBook | null>(null);
  const [ritualStatus, setRitualStatus] = useState<RitualStatus>(createInitialRitualStatus);
  const [ritualError, setRitualError] = useState<string | null>(null);
  const [selectedRelic, setSelectedRelic] = useState<string | null>(null);
  const [selectedFinalQuote, setSelectedFinalQuote] = useState<string | null>(null);
  const [error, setError] = useState("The archives refused to open. Try again.");
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [legendRevealDone, setLegendRevealDone] = useState(false);
  const [musicAvailable, setMusicAvailable] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPlayingFirstLine, setIsPlayingFirstLine] = useState(false);

  const introVideoSrc = getRitualLaunchVideoSrc();

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const generationRunRef = useRef(0);
  const bindingTimerRef = useRef<number | undefined>(undefined);

  const shouldPlayAmbientMusic = step === "form" && !ambientMuted;

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  useEffect(() => {
    let cancelled = false;

    fetch("/audio/mysterious-theme.mp3", { method: "HEAD" })
      .then((response) => {
        if (!cancelled) {
          setMusicAvailable(response.ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMusicAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "form" || !isRitualLaunchVideoConfigured()) {
      return;
    }

    return prefetchRitualLaunchVideo();
  }, [step]);

  useEffect(() => {
    if (step !== "creationRitual" && step !== "ritualVideo") {
      return;
    }

    if (!ritualStatus.loreReady) {
      const timer = window.setInterval(() => {
        setRitualStatus((current) => ({
          ...current,
          progress: Math.min(18, current.progress + 0.22),
        }));
      }, 420);

      return () => window.clearInterval(timer);
    }
  }, [ritualStatus.loreReady, step]);

  useEffect(() => {
    if (step !== "creationRitual" || !musicAvailable || !musicEnabled || !musicRef.current) {
      musicRef.current?.pause();
      return;
    }

    musicRef.current.volume = 0.12;
    void musicRef.current.play().catch(() => {
      setMusicEnabled(false);
    });

    return () => {
      musicRef.current?.pause();
    };
  }, [musicAvailable, musicEnabled, step]);

  const updateRitualStatus = useCallback((updater: (current: RitualStatus) => RitualStatus) => {
    setRitualStatus((current) => {
      const next = updater(current);
      const phase = next.phase === "complete" ? "complete" : computeRitualPhase(next);
      const progress = Math.max(next.progress, computeTargetProgress({ ...next, phase }));
      return { ...next, phase, progress };
    });
  }, []);

  const beginBindingPhase = useCallback(
    (preparedBook: LoreBook, runId: number) => {
      updateRitualStatus((current) => ({
        ...current,
        phase: "binding",
        bindingStartedAt: Date.now(),
        progress: Math.max(current.progress, 78),
      }));

      bindingTimerRef.current = window.setTimeout(() => {
        if (generationRunRef.current !== runId) {
          return;
        }

        setBook(preparedBook);
        updateRitualStatus((current) => ({
          ...current,
          phase: "complete",
          progress: 100,
          videoReady: false,
        }));
      }, BINDING_DURATION_MS);
    },
    [updateRitualStatus],
  );

  const advanceAfterVideo = useCallback(() => {
    if (book || ritualStatus.phase === "complete") {
      setStep("book");
      return;
    }

    if (ritualBook && ritualStatus.loreReady) {
      setStep("legendReveal");
      return;
    }

    setStep("creationRitual");
  }, [book, ritualBook, ritualStatus.loreReady, ritualStatus.phase]);

  useEffect(() => {
    if (ritualError && step === "ritualVideo") {
      advanceAfterVideo();
    }
  }, [advanceAfterVideo, ritualError, step]);

  async function runCreationRitual(input: BookFormInput, runId: number) {
    const response = await fetch("/api/generate-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await readJsonResponse<{ book?: LoreBook; error?: string }>(response);
    if (!response.ok || !data.book) {
      throw new Error(data.error || "The archive resisted the ritual. Try again.");
    }

    if (generationRunRef.current !== runId) {
      return;
    }

    const baseBook = data.book;
    const region = baseBook.mainRegion || baseBook.characterBible.region;
    const pages = [...baseBook.pages];
    const experiencePages = pages.slice(0, ILLUSTRATED_PAGE_COUNT);

    setRitualBook(baseBook);
    setSelectedRelic(pickDefaultRelic(region));
    setSelectedFinalQuote(pickDefaultQuote(baseBook));

    updateRitualStatus((current) => ({
      ...current,
      loreReady: true,
      phase: "character",
      progress: Math.max(current.progress, 22),
    }));

    let imagesReadyCount = 0;
    let audioReadyCount = 0;

    const syncBook = () => {
      if (generationRunRef.current !== runId) {
        return;
      }
      setRitualBook({ ...baseBook, pages: [...pages] });
      updateRitualStatus((current) => ({
        ...current,
        imagesReadyCount,
        audioReadyCount,
      }));
    };

    const generatePageImage = async (page: (typeof experiencePages)[number]) => {
      const index = page.pageNumber - 1;
      try {
        const imageUrl = await generateImageForPage(baseBook, page.pageNumber);
        pages[index] = { ...pages[index], imageUrl };
      } catch {
        pages[index] = { ...pages[index], imageUrl: undefined };
      } finally {
        imagesReadyCount += 1;
        syncBook();
      }
    };

    const firstPage = experiencePages[0];
    const remainingImagePages = firstPage ? experiencePages.slice(1) : experiencePages;

    if (firstPage) {
      void generatePageImage(firstPage);
    }

    const assetPromises = [
      ...remainingImagePages.map((page) => generatePageImage(page)),
      ...experiencePages.map(async (page) => {
        const index = page.pageNumber - 1;
        try {
          const audioUrl = await generateAudioForPage(page);
          pages[index] = { ...pages[index], audioUrl };
        } catch {
          pages[index] = { ...pages[index], audioUrl: null };
        } finally {
          audioReadyCount += 1;
          syncBook();
        }
      }),
    ];

    await Promise.allSettled(assetPromises);

    if (generationRunRef.current !== runId) {
      return;
    }

    const preparedBook = { ...baseBook, pages };
    setRitualBook(preparedBook);
    beginBindingPhase(preparedBook, runId);
  }

  function handleSubmit(input: BookFormInput) {
    generationRunRef.current += 1;
    const runId = generationRunRef.current;

    if (bindingTimerRef.current) {
      window.clearTimeout(bindingTimerRef.current);
    }

    setFormInput(input);
    setRitualError(null);
    setRitualBook(null);
    setBook(null);
    setLegendRevealDone(false);
    setRitualStatus(createInitialRitualStatus());
    setIsPlayingFirstLine(false);
    setSelectedRelic(null);
    setSelectedFinalQuote(null);
    setError("The archives refused to open. Try again.");
    voiceRef.current?.pause();

    const hasIntroVideo = isRitualLaunchVideoConfigured() && Boolean(introVideoSrc);
    setStep(hasIntroVideo ? "ritualVideo" : "creationRitual");

    void runCreationRitual(input, runId).catch((generationError) => {
      if (generationRunRef.current !== runId) {
        return;
      }
      setRitualError(
        generationError instanceof Error
          ? generationError.message
          : "The archive resisted the ritual. Try again.",
      );
      setError(
        generationError instanceof Error
          ? generationError.message
          : "The archive resisted the ritual. Try again.",
      );
    });
  }

  function handleRitualComplete() {
    if (book) {
      setStep("book");
    }
  }

  function handleRitualRetry() {
    if (formInput) {
      handleSubmit(formInput);
    } else {
      setRitualError(null);
      setStep("form");
    }
  }

  function handleLegendRevealComplete() {
    setLegendRevealDone(true);
    if (book || ritualStatus.phase === "complete") {
      setStep("book");
      return;
    }
    setStep("creationRitual");
  }

  function reset() {
    generationRunRef.current += 1;
    if (bindingTimerRef.current) {
      window.clearTimeout(bindingTimerRef.current);
    }
    setBook(null);
    setRitualBook(null);
    setFormInput(null);
    setRitualError(null);
    setLegendRevealDone(false);
    setStep("form");
  }

  const playFirstNarratedLine = useCallback(async () => {
    if (!voiceEnabled || !ritualBook) {
      return;
    }

    const firstPage = ritualBook.pages[0];
    const audioUrl = firstPage?.audioUrl;
    if (!audioUrl) {
      return;
    }

    if (!voiceRef.current) {
      voiceRef.current = new Audio();
    }

    const voice = voiceRef.current;
    voice.pause();
    voice.src = audioUrl;
    voice.volume = 0.8;
    setIsPlayingFirstLine(true);

    voice.onended = () => setIsPlayingFirstLine(false);
    voice.onerror = () => setIsPlayingFirstLine(false);

    try {
      await voice.play();
    } catch {
      setIsPlayingFirstLine(false);
    }
  }, [ritualBook, voiceEnabled]);

  const firstPageAudioUrl = ritualBook?.pages[0]?.audioUrl || null;
  const firstRevealImageUrl = ritualBook?.pages[0]?.imageUrl || null;

  return (
    <>
      <AmbientMusicPlayer shouldPlay={shouldPlayAmbientMusic} />

      {step === "form" ? (
        <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
      ) : null}

      {musicAvailable ? <audio ref={musicRef} src="/audio/mysterious-theme.mp3" loop preload="auto" /> : null}

      <AnimatePresence mode="wait">
        {step === "intro" ? (
          <motion.div key="intro" exit={{ opacity: 0, filter: "blur(14px)" }} transition={{ duration: 0.55 }}>
            <IntroGate onStart={() => setStep("startTransition")} />
          </motion.div>
        ) : null}

        {step === "startTransition" ? (
          <motion.div
            key="startTransition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.45 }}
          >
            <MysticalStartTransition onComplete={() => setStep("form")} />
          </motion.div>
        ) : null}

        {step === "form" ? (
          <motion.div key="form" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.35 }}>
            <ProgressiveLoreForm onSubmit={handleSubmit} />
          </motion.div>
        ) : null}

        {step === "ritualVideo" && introVideoSrc ? (
          <motion.div key="ritualVideo" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <RitualLaunchVideo
              src={introVideoSrc}
              poster={RITUAL_LAUNCH_VIDEO_POSTER}
              onEnded={advanceAfterVideo}
              onSkip={advanceAfterVideo}
            />
          </motion.div>
        ) : null}

        {step === "legendReveal" && ritualBook ? (
          <motion.div key="legendReveal" exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <LegendRevealSequence
              isVisible
              name={ritualBook.characterBible.name}
              legendaryTitle={ritualBook.characterBible.legendaryTitle}
              region={ritualBook.mainRegion || ritualBook.characterBible.region}
              imageUrl={firstRevealImageUrl}
              onComplete={handleLegendRevealComplete}
            />
          </motion.div>
        ) : null}

        {step === "creationRitual" && formInput ? (
          <motion.div key="creationRitual" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.65 }}>
            <CreationRitual
              formInput={formInput}
              book={ritualBook}
              status={ritualStatus}
              error={ritualError}
              selectedRelic={selectedRelic}
              selectedFinalQuote={selectedFinalQuote}
              onRelicSelect={setSelectedRelic}
              onQuoteSelect={setSelectedFinalQuote}
              onComplete={handleRitualComplete}
              onRetry={handleRitualRetry}
              onBack={() => {
                generationRunRef.current += 1;
                setRitualError(null);
                setStep("form");
              }}
              musicAvailable={musicAvailable}
              musicEnabled={musicEnabled}
              voiceEnabled={voiceEnabled}
              onToggleMusic={() => setMusicEnabled((current) => !current)}
              onToggleVoice={() => {
                setVoiceEnabled((current) => {
                  const next = !current;
                  if (!next) {
                    voiceRef.current?.pause();
                    setIsPlayingFirstLine(false);
                  }
                  return next;
                });
              }}
              firstPageAudioUrl={firstPageAudioUrl}
              onPlayFirstLine={() => void playFirstNarratedLine()}
              isPlayingFirstLine={isPlayingFirstLine}
              skipLegendReveal={legendRevealDone}
            />
          </motion.div>
        ) : null}

        {step === "book" && book ? (
          <motion.div key="book" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <InteractiveBook book={book} onReset={reset} />
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
              <p className="mt-4 text-sm leading-7 text-[#9baabd]">{error}</p>
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
