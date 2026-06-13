"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CharacterReveal from "@/components/CharacterReveal";
import FinalQuoteChoice from "@/components/FinalQuoteChoice";
import LegendRevealSequence from "@/components/LegendRevealSequence";
import MagicalRitualBackground from "@/components/MagicalRitualBackground";
import RitualLaunchVideo from "@/components/RitualLaunchVideo";
import PagePreviewRitual from "@/components/PagePreviewRitual";
import RelicChoice from "@/components/RelicChoice";
import RitualPhase from "@/components/RitualPhase";
import RitualProgress from "@/components/RitualProgress";
import VideoBindingChecklist from "@/components/VideoBindingChecklist";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { isExternalRitualVideoUrl, RITUAL_LAUNCH_VIDEO_PATH } from "@/lib/video-config";
import {
  PHASE_MESSAGES,
  computeTargetProgress,
  generateFinalQuotes,
  getRelicsForRegion,
  type RitualStatus,
} from "@/lib/ritual";
import type { BookFormInput, LoreBook } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CreationRitualProps = {
  formInput: BookFormInput;
  book: LoreBook | null;
  status: RitualStatus;
  error: string | null;
  selectedRelic: string | null;
  selectedFinalQuote: string | null;
  onRelicSelect: (relic: string) => void;
  onQuoteSelect: (quote: string) => void;
  onComplete: () => void;
  onRetry: () => void;
  onBack: () => void;
  musicAvailable?: boolean;
  musicEnabled?: boolean;
  voiceEnabled?: boolean;
  onToggleMusic?: () => void;
  onToggleVoice?: () => void;
  firstPageAudioUrl?: string | null;
  onPlayFirstLine?: () => void;
  isPlayingFirstLine?: boolean;
};

function BookSilhouette({ glowing = false }: { glowing?: boolean }) {
  return (
    <motion.div
      className={cn("ritual-book-silhouette", glowing && "ritual-book-silhouette-glow")}
      animate={glowing ? { scale: [1, 1.03, 1] } : { y: [0, -5, 0] }}
      transition={{ duration: glowing ? 3.5 : 6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <div className="ritual-silhouette-spine" />
      <div className="ritual-silhouette-pages" />
      <div className="ritual-silhouette-cover">
        <div className="ritual-silhouette-medallion" />
      </div>
    </motion.div>
  );
}

function VoiceWaveform({ active }: { active: boolean }) {
  return (
    <div className="ritual-waveform" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <motion.span
          key={index}
          className="ritual-waveform-bar"
          animate={active ? { scaleY: [0.35, 1, 0.5, 0.85, 0.4] } : { scaleY: 0.25 }}
          transition={{
            duration: 1.1,
            repeat: active ? Infinity : 0,
            delay: index * 0.07,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function CreationRitual({
  formInput,
  book,
  status,
  error,
  selectedRelic,
  selectedFinalQuote,
  onRelicSelect,
  onQuoteSelect,
  onComplete,
  onRetry,
  onBack,
  musicAvailable = false,
  musicEnabled = true,
  voiceEnabled = true,
  onToggleMusic,
  onToggleVoice,
  firstPageAudioUrl,
  onPlayFirstLine,
  isPlayingFirstLine = false,
}: CreationRitualProps) {
  const [displayProgress, setDisplayProgress] = useState(status.progress);
  const [messageIndex, setMessageIndex] = useState(0);
  const [characterRevealed, setCharacterRevealed] = useState(false);
  const [legendRevealDone, setLegendRevealDone] = useState(false);
  const [postRevealMessage, setPostRevealMessage] = useState(false);
  const [launchVideoDone, setLaunchVideoDone] = useState(false);
  const [launchVideoAvailable, setLaunchVideoAvailable] = useState(false);
  const characterTimerRef = useRef<number | undefined>(undefined);
  const revealSessionRef = useRef<string | null>(null);
  const launchSessionRef = useRef<string | null>(null);

  const showLaunchVideo = launchVideoAvailable && !launchVideoDone && !error;

  const phase = status.phase;
  const messages = PHASE_MESSAGES[phase];
  const currentMessage = messages[messageIndex % messages.length] || status.message;

  const previewPages = useMemo(
    () => book?.pages.slice(0, ILLUSTRATED_PAGE_COUNT) || [],
    [book?.pages],
  );

  const visiblePageCount = useMemo(() => {
    if (!book) return 0;
    if (phase === "pages" || phase === "voice" || phase === "binding") {
      return Math.min(
        previewPages.length,
        Math.max(status.loreReady ? 2 : 1, status.imagesReadyCount),
      );
    }
    return 0;
  }, [book, phase, previewPages.length, status.imagesReadyCount, status.loreReady]);

  const region = book?.mainRegion || book?.characterBible.region || formInput.runeterraRegion;
  const relics = useMemo(() => getRelicsForRegion(region === "Auto" ? "Ionia" : region), [region]);
  const quotes = useMemo(() => (book ? generateFinalQuotes(book) : []), [book]);

  const showLegendReveal = Boolean(
    book && status.loreReady && !legendRevealDone && phase !== "complete",
  );

  const firstRevealImageUrl = book?.pages[0]?.imageUrl || null;

  const showChoices = Boolean(
    book && status.loreReady && legendRevealDone && phase !== "archive" && phase !== "complete",
  );
  const showCharacter = Boolean(
    book &&
      status.loreReady &&
      legendRevealDone &&
      characterRevealed &&
      phase !== "archive" &&
      phase !== "complete",
  );

  useEffect(() => {
    const sessionKey = formInput.name;
    if (launchSessionRef.current !== sessionKey) {
      launchSessionRef.current = sessionKey;
      setLaunchVideoDone(false);
    }
  }, [formInput.name]);

  useEffect(() => {
    if (isExternalRitualVideoUrl()) {
      setLaunchVideoAvailable(true);
      return;
    }

    let cancelled = false;

    fetch(RITUAL_LAUNCH_VIDEO_PATH, { method: "HEAD" })
      .then((response) => {
        if (!cancelled) {
          setLaunchVideoAvailable(response.ok);
          if (!response.ok) {
            setLaunchVideoDone(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLaunchVideoAvailable(false);
          setLaunchVideoDone(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!book || !status.loreReady) {
      setLegendRevealDone(false);
      setPostRevealMessage(false);
      revealSessionRef.current = null;
      return;
    }

    const sessionKey = `${book.characterBible.name}-${book.title}`;
    if (revealSessionRef.current !== sessionKey) {
      revealSessionRef.current = sessionKey;
      setLegendRevealDone(false);
      setPostRevealMessage(false);
    }
  }, [book, status.loreReady]);

  useEffect(() => {
    if (!status.loreReady || !book || !legendRevealDone || characterRevealed) {
      return;
    }

    characterTimerRef.current = window.setTimeout(() => {
      setCharacterRevealed(true);
    }, 900);

    return () => {
      if (characterTimerRef.current) {
        window.clearTimeout(characterTimerRef.current);
      }
    };
  }, [book, characterRevealed, legendRevealDone, status.loreReady]);

  const handleLegendRevealComplete = useCallback(() => {
    setLegendRevealDone(true);
    setPostRevealMessage(true);
    window.setTimeout(() => setPostRevealMessage(false), 5000);
  }, []);

  useEffect(() => {
    setMessageIndex(0);
  }, [phase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [messages.length, phase]);

  useEffect(() => {
    const target = phase === "complete" ? 100 : computeTargetProgress(status);
    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (phase === "complete") return 100;
        if (current >= 99 && target < 99) return current;
        const cap = Math.min(target, 99);
        const step = Math.max(0.12, (cap - current) * 0.07);
        return Math.min(99, current + step);
      });
    }, 380);
    return () => window.clearInterval(timer);
  }, [phase, status]);

  useEffect(() => {
    if (status.progress > displayProgress) {
      setDisplayProgress((current) => Math.max(current, status.progress));
    }
  }, [displayProgress, status.progress]);

  const handleOpenBook = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (error) {
    return (
      <main className="archive-shell ritual-shell relative flex min-h-screen items-center justify-center px-5">
        <MagicalRitualBackground phase="archive" />
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ritual-panel relative z-10 max-w-lg rounded-[2rem] p-8 text-center"
        >
          <p className="font-title text-xs uppercase tracking-[0.32em] text-[#a89068]/80">The seal resisted</p>
          <h1 className="font-cover-title mt-4 text-3xl text-[#e8dcc8]/92">The archive resisted the ritual.</h1>
          <p className="mt-4 text-sm leading-7 text-[#8a9aad]/85">Try again.</p>
          <p className="mt-2 text-xs text-[#6a7a8a]/70">{error}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={onRetry} className="gold-button rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]">
              Try again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-white/10 px-6 py-3 text-xs font-bold uppercase tracking-[0.22em] text-[#9baabd]"
            >
              Return to form
            </button>
          </div>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="archive-shell ritual-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-6">
      <MagicalRitualBackground phase={phase} />

      <AnimatePresence>
        {showLaunchVideo ? (
          <RitualLaunchVideo key="launch-video" onComplete={() => setLaunchVideoDone(true)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showLegendReveal && book ? (
          <LegendRevealSequence
            key="legend-reveal"
            isVisible={showLegendReveal}
            name={book.characterBible.name}
            legendaryTitle={book.characterBible.legendaryTitle}
            region={book.mainRegion || book.characterBible.region}
            imageUrl={firstRevealImageUrl}
            onComplete={handleLegendRevealComplete}
          />
        ) : null}
      </AnimatePresence>

      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col transition-opacity duration-700",
          showLaunchVideo || showLegendReveal ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <header className="mb-6 text-center">
          <p className="font-title text-[0.62rem] uppercase tracking-[0.38em] text-[#a89068]/75">
            The Creation Ritual
          </p>
          <h1 className="font-cover-title mt-2 text-2xl text-[#e8dcc8]/88 sm:text-3xl">
            {formInput.name}&rsquo;s legend is being written
          </h1>
        </header>

        <RitualProgress phase={phase} progress={displayProgress} />

        <div className="mt-8 flex-1">
          <AnimatePresence mode="wait">
            {phase === "complete" ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="flex flex-col items-center text-center"
              >
                <BookSilhouette glowing />
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-cover-title mt-8 text-3xl text-[#e8dcc8]/95 sm:text-4xl"
                >
                  Your legend is bound.
                </motion.p>
                {selectedRelic ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[#7a8ea8]/75">
                    Sealed with: {selectedRelic}
                  </p>
                ) : null}
                {selectedFinalQuote ? (
                  <p className="font-cover-title mt-4 max-w-md text-base italic text-[#c9b888]/80">
                    &ldquo;{selectedFinalQuote}&rdquo;
                  </p>
                ) : null}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={handleOpenBook}
                  className="gold-button mt-8 rounded-full px-8 py-4 text-xs font-bold uppercase tracking-[0.28em]"
                >
                  Open the book
                </motion.button>
                <p className="mt-4 text-[0.58rem] uppercase tracking-[0.2em] text-[#6a7a8a]/65">
                  Cinematic video rendering — preview ready
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.55 }}
              >
                <RitualPhase
                  phase={phase}
                  message={
                    postRevealMessage
                      ? "The first page is being written…"
                      : currentMessage
                  }
                >
                  {(phase === "archive" || (phase === "binding" && !showCharacter)) && (
                    <div className="flex justify-center py-4">
                      <BookSilhouette glowing={phase === "binding"} />
                    </div>
                  )}

                  {showCharacter && book ? <CharacterReveal book={book} /> : null}

                  {book && (phase === "pages" || phase === "voice" || phase === "binding") && visiblePageCount > 0 ? (
                    <div className="mt-6">
                      <PagePreviewRitual pages={previewPages} visibleCount={visiblePageCount} />
                    </div>
                  ) : null}

                  {phase === "voice" ? (
                    <div className="ritual-voice-panel mt-6 rounded-2xl border border-[#c9a858]/12 p-5 text-center">
                      <VoiceWaveform active={status.audioReadyCount > 0 || isPlayingFirstLine} />
                      <p className="mt-4 text-sm text-[#9baabd]/85">
                        The narrator has found its voice…
                      </p>
                      {firstPageAudioUrl && onPlayFirstLine ? (
                        <button
                          type="button"
                          onClick={onPlayFirstLine}
                          disabled={!voiceEnabled}
                          className="mt-4 rounded-full border border-[#c9a858]/30 px-5 py-2.5 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#d4c4a0]/85 transition hover:border-[#c9a858]/50 disabled:opacity-40"
                        >
                          {isPlayingFirstLine ? "Playing first line…" : "Play first narrated line"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {phase === "binding" ? (
                    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                      <div className="flex justify-center">
                        <BookSilhouette glowing />
                      </div>
                      <VideoBindingChecklist
                        loreReady={status.loreReady}
                        imagesReadyCount={status.imagesReadyCount}
                        totalImages={status.totalImages}
                        audioReadyCount={status.audioReadyCount}
                        totalAudio={status.totalAudio}
                        bookReady={status.imagesReadyCount >= status.totalImages && status.audioReadyCount >= status.totalAudio}
                        videoReady={status.videoReady}
                      />
                    </div>
                  ) : null}

                  {showChoices && book ? (
                    <div className="mt-8 space-y-5">
                      <RelicChoice relics={relics} selected={selectedRelic} onSelect={onRelicSelect} />
                      <FinalQuoteChoice quotes={quotes} selected={selectedFinalQuote} onSelect={onQuoteSelect} />
                    </div>
                  ) : null}
                </RitualPhase>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-white/[0.04] pt-5">
          {musicAvailable && onToggleMusic ? (
            <button
              type="button"
              onClick={onToggleMusic}
              className="rounded-full border border-white/10 px-4 py-2 text-[0.58rem] uppercase tracking-[0.2em] text-[#8a9aad]/80"
            >
              Music {musicEnabled ? "on" : "off"}
            </button>
          ) : null}
          {onToggleVoice ? (
            <button
              type="button"
              onClick={onToggleVoice}
              className="rounded-full border border-white/10 px-4 py-2 text-[0.58rem] uppercase tracking-[0.2em] text-[#8a9aad]/80"
            >
              Voice {voiceEnabled ? "on" : "off"}
            </button>
          ) : null}
          {phase === "binding" ? (
            <p className="w-full text-center text-[0.58rem] uppercase tracking-[0.2em] text-[#6a7a8a]/70">
              Do not close this page. The final binding is near.
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}
