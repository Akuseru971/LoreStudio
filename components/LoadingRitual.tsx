"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const phrases = [
  "Opening the forgotten archives...",
  "Binding your name to Runeterra...",
  "Forging the pages of your legend...",
  "Painting the first visions...",
  "Awakening every narrator voice...",
];

export default function LoadingRitual() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 37) % 100}%`,
        bottom: `${(index * 19) % 70}%`,
        delay: `${(index % 7) * 0.45}s`,
        duration: `${6 + (index % 5)}s`,
      })),
    [],
  );

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, 1500);

    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(94, current + Math.max(0.6, (94 - current) * 0.045)));
    }, 450);

    return () => {
      window.clearInterval(phraseTimer);
      window.clearInterval(progressTimer);
    };
  }, []);

  return (
    <main className="archive-shell relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(159,184,216,0.12),transparent_34rem)]" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="ritual-particle"
          style={{
            left: particle.left,
            bottom: particle.bottom,
            animationDelay: particle.delay,
            "--duration": particle.duration,
          } as React.CSSProperties}
        />
      ))}

      <section className="glass-panel relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] px-6 py-10 text-center sm:px-10">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-[#d9bd78]/25 bg-[#d9bd78]/10 shadow-[0_0_70px_rgba(217,189,120,0.14)]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="h-16 w-16 rounded-full border border-dashed border-[#d9bd78]/80"
          />
        </div>

        <p className="font-title text-sm uppercase tracking-[0.4em] text-[#d9bd78]">Ritual in progress</p>
        <div className="mt-5 min-h-20">
          <AnimatePresence mode="wait">
            <motion.h1
              key={phraseIndex}
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
              transition={{ duration: 0.45 }}
              className="font-title text-3xl leading-tight text-[#f7ebce] sm:text-4xl"
            >
              {phrases[phraseIndex]}
            </motion.h1>
          </AnimatePresence>
        </div>

        <div className="mt-8 overflow-hidden rounded-full border border-white/10 bg-black/45 p-1">
          <motion.div
            className="h-3 rounded-full bg-gradient-to-r from-[#6f7f9a] via-[#d9bd78] to-[#f4e0a8]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-[#9baabd]">
          The story, illustrations, and narrator voices are being bound before the book appears.
        </p>
      </section>
    </main>
  );
}
