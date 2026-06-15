"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import IntroGate from "@/components/IntroGate";
import MysticalStartTransition from "@/components/MysticalStartTransition";
import InteractiveBook from "@/components/InteractiveBook";
import LoadingRitual from "@/components/LoadingRitual";
import ProgressiveLoreForm from "@/components/ProgressiveLoreForm";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import type { BookFormInput, LoreBook } from "@/lib/types";

type ViewState = "intro" | "transition" | "form" | "loading" | "book" | "error";

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
  const experiencePages = pages.slice(0, ILLUSTRATED_PAGE_COUNT);

  const [imageResults, audioResults] = await Promise.all([
    Promise.allSettled(experiencePages.map((page) => generateImageForPage(book, page.pageNumber))),
    Promise.allSettled(experiencePages.map((page) => generateAudioForPage(page))),
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

export default function Home() {
  const [view, setView] = useState<ViewState>("intro");
  const [book, setBook] = useState<LoreBook | null>(null);
  const [error, setError] = useState("The archives refused to open. Try again.");
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());

  const shouldPlayAmbientMusic = view === "form" && !ambientMuted;

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  async function handleSubmit(input: BookFormInput) {
    setView("loading");
    setError("The archives refused to open. Try again.");

    try {
      const response = await fetch("/api/generate-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await readJsonResponse<{ book?: LoreBook; error?: string }>(response);
      if (!response.ok || !data.book) {
        throw new Error(data.error || "The archives refused to open. Try again.");
      }

      const preparedBook = await attachInitialAssets(data.book);
      setBook(preparedBook);
      setView("book");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "The archives refused to open. Try again.");
      setView("error");
    }
  }

  function reset() {
    setBook(null);
    setView("form");
  }

  return (
    <>
      <AmbientMusicPlayer shouldPlay={shouldPlayAmbientMusic} />

      {view === "form" ? (
        <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
      ) : null}

      <AnimatePresence mode="wait">
      {view === "intro" ? (
        <motion.div key="intro" exit={{ opacity: 0, filter: "blur(14px)" }} transition={{ duration: 0.55 }}>
          <IntroGate onStart={() => setView("transition")} />
        </motion.div>
      ) : null}

      {view === "transition" ? (
        <motion.div
          key="transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.45 }}
        >
          <MysticalStartTransition onComplete={() => setView("form")} />
        </motion.div>
      ) : null}

      {view === "form" ? (
        <motion.div key="form" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.35 }}>
          <ProgressiveLoreForm onSubmit={handleSubmit} />
        </motion.div>
      ) : null}

      {view === "loading" ? (
        <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <LoadingRitual />
        </motion.div>
      ) : null}

      {view === "book" && book ? (
        <motion.div key="book" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <InteractiveBook book={book} onReset={reset} />
        </motion.div>
      ) : null}

      {view === "error" ? (
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
