"use client";

// MVP LOCKED INTRO CAROUSEL:
// Do not remove or modify this carousel unless explicitly requested.

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MagicalBackground from "@/components/MagicalBackground";
import { cn } from "@/lib/utils";

type IntroCarouselProps = {
  onBegin: () => void;
};

const SLIDES = [
  {
    title: "Create your own legend",
    text: "Enter your name and shape the beginning of a personalized fantasy biography written like an ancient chronicle.",
  },
  {
    title: "Choose your path",
    text: "Select your region, role, and identity. A short synopsis will reveal the direction of your legend before the full book is created.",
  },
  {
    title: "Unlock the complete chronicle",
    text: "Read the first pages for free, then unlock the full illustrated book, narration, PDF, and MP3 version.",
  },
] as const;

export default function IntroCarousel({ onBegin }: IntroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback((nextIndex: number) => {
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(Math.min(Math.max(nextIndex, 0), SLIDES.length - 1));
  }, [index]);

  function handleNext() {
    if (isLast) {
      onBegin();
      return;
    }
    goTo(index + 1);
  }

  function handlePrevious() {
    goTo(index - 1);
  }

  const slide = SLIDES[index];

  return (
    <main className="archive-shell relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <MagicalBackground intensity="intro" />
      <section className="relative z-10 w-full max-w-lg">
        <div className="glass-panel overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction >= 0 ? 36 : -36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction >= 0 ? -36 : 36 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -72) {
                  handleNext();
                } else if (info.offset.x > 72) {
                  handlePrevious();
                }
              }}
              className="touch-pan-y text-center"
            >
              <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#7eb6ff]/85">
                {index + 1} / {SLIDES.length}
              </p>
              <h1 className="font-title mt-4 text-2xl leading-tight text-[#f7ebce] sm:text-3xl">{slide.title}</h1>
              <p className="mt-5 text-sm leading-7 text-[#c9d3df]/90">{slide.text}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2">
            {SLIDES.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                aria-label={`Go to slide ${dotIndex + 1}`}
                onClick={() => goTo(dotIndex)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  dotIndex === index ? "w-6 bg-[#d9bd78]" : "w-2 bg-[#d9bd78]/30",
                )}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={index === 0}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="gold-button rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
            >
              {isLast ? "Begin" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
