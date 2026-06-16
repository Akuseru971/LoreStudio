"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export type MysticalStartTransitionProps = {
  onComplete: () => void;
};

const TRANSITION_MS = 3000;
const MESSAGE = "Let the archive open…";

export default function MysticalStartTransition({ onComplete }: MysticalStartTransitionProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 32 }, (_, index) => {
        const angle = (index / 32) * Math.PI * 2 + (index % 5) * 0.18;
        const radius = 34 + (index % 7) * 5;
        return {
          id: index,
          startX: Math.cos(angle) * radius,
          startY: Math.sin(angle) * radius,
          delay: 0.75 + (index % 8) * 0.04,
          size: 1.5 + (index % 3) * 0.75,
        };
      }),
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(onComplete, TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className="mystical-start-transition archive-shell relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <motion.div
        className="mystical-start-transition-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-hidden="true"
      />

      <motion.div
        className="mystical-start-transition-smoke mystical-start-transition-smoke-a"
        initial={{ opacity: 0.12, scale: 0.92 }}
        animate={{ opacity: 0.52, scale: 1.08 }}
        transition={{ delay: 0.35, duration: 1.8, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="mystical-start-transition-smoke mystical-start-transition-smoke-b"
        initial={{ opacity: 0.08, scale: 1 }}
        animate={{ opacity: 0.38, scale: 1.14 }}
        transition={{ delay: 0.45, duration: 2, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="mystical-start-transition-smoke mystical-start-transition-smoke-c"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.28 }}
        transition={{ delay: 0.55, duration: 1.6, ease: "easeOut" }}
        aria-hidden="true"
      />

      <div className="mystical-start-transition-core" aria-hidden="true">
        {particles.map((particle) => (
          <motion.span
            key={particle.id}
            className="mystical-start-transition-spark"
            style={{
              width: particle.size,
              height: particle.size,
              ["--start-x" as string]: `${particle.startX}vw`,
              ["--start-y" as string]: `${particle.startY}vh`,
            }}
            initial={{ opacity: 0, x: `${particle.startX}vw`, y: `${particle.startY}vh`, scale: 0.4 }}
            animate={{ opacity: [0, 0.95, 0.2], x: 0, y: 0, scale: [0.4, 1, 0.35] }}
            transition={{
              delay: particle.delay,
              duration: 1.35,
              ease: [0.22, 0.68, 0.24, 1],
            }}
          />
        ))}

        <motion.div
          className="mystical-start-transition-burst"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0.55, 0], scale: [0.6, 1.15, 1.35] }}
          transition={{ delay: 1.05, duration: 1.5, ease: "easeOut" }}
        />

        <motion.div
          className="mystical-start-transition-seal"
          initial={{ opacity: 0, scale: 0.72, rotate: -18 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0.72, 1, 1.06], rotate: [-18, 0, 8] }}
          transition={{ delay: 1.15, duration: 1.55, ease: "easeInOut" }}
        >
          <span className="mystical-start-transition-seal-ring mystical-start-transition-seal-ring-outer" />
          <span className="mystical-start-transition-seal-ring mystical-start-transition-seal-ring-inner" />
          <span className="mystical-start-transition-seal-glyph" />
        </motion.div>
      </div>

      <motion.p
        className="mystical-start-transition-message font-cover-title"
        initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
        animate={{ opacity: [0, 0.92, 0], y: [14, 0, -8], filter: ["blur(8px)", "blur(0px)", "blur(6px)"] }}
        transition={{ delay: 1.55, duration: 1.35, ease: "easeInOut" }}
      >
        {MESSAGE}
      </motion.p>
    </main>
  );
}
