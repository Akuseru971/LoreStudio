"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HeroForm from "@/components/HeroForm";
import InteractiveBook from "@/components/InteractiveBook";
import LoadingRitual from "@/components/LoadingRitual";
import type { BookFormInput, LoreBook } from "@/lib/types";

type ViewState = "form" | "loading" | "book" | "error";

export default function Home() {
  const [view, setView] = useState<ViewState>("form");
  const [book, setBook] = useState<LoreBook | null>(null);
  const [error, setError] = useState("The archives refused to open. Try again.");

  async function handleSubmit(input: BookFormInput) {
    setView("loading");
    setError("The archives refused to open. Try again.");

    try {
      const response = await fetch("/api/generate-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = (await response.json()) as { book?: LoreBook; error?: string };
      if (!response.ok || !data.book) {
        throw new Error(data.error || "The archives refused to open. Try again.");
      }

      setBook(data.book);
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
    <AnimatePresence mode="wait">
      {view === "form" ? (
        <motion.div key="form" exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.35 }}>
          <HeroForm onSubmit={handleSubmit} />
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
  );
}
