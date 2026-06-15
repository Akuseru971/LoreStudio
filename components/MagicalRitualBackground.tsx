"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { RitualPhase } from "@/lib/ritual";

type MagicalRitualBackgroundProps = {
  phase?: RitualPhase;
};

export default function MagicalRitualBackground({ phase = "archive" }: MagicalRitualBackgroundProps) {
  const sparks = useMemo(
    () =>
      Array.from({ length: phase === "binding" ? 22 : 30 }, (_, index) => ({
        id: index,
        left: `${(index * 23 + 7) % 100}%`,
        top: `${(index * 31 + 11) % 100}%`,
        delay: `${(index % 8) * 0.42}s`,
        duration: `${6 + (index % 6)}s`,
        size: `${1.5 + (index % 2.5)}px`,
      })),
    [phase],
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        id: index,
        left: `${(index * 37) % 100}%`,
        bottom: `${(index * 19) % 70}%`,
        delay: `${(index % 7) * 0.45}s`,
        duration: `${6 + (index % 5)}s`,
      })),
    [],
  );

  return (
    <div className="ritual-background pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="ritual-background-gradient" />
      <motion.div
        className="ritual-smoke ritual-smoke-a"
        animate={{ x: [0, 24, -12, 0], y: [0, -16, 10, 0], opacity: [0.4, 0.62, 0.48, 0.4] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ritual-smoke ritual-smoke-b"
        animate={{ x: [0, -28, 14, 0], y: [0, 12, -8, 0], opacity: [0.28, 0.48, 0.34, 0.28] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ritual-smoke ritual-smoke-c"
        animate={{ x: [0, 16, -20, 0], y: [0, -10, 14, 0], opacity: [0.22, 0.38, 0.28, 0.22] }}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="rune-glow absolute left-1/2 top-[42%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25" />

      {particles.map((particle) => (
        <span
          key={particle.id}
          className="ritual-particle"
          style={
            {
              left: particle.left,
              bottom: particle.bottom,
              animationDelay: particle.delay,
              "--duration": particle.duration,
            } as CSSProperties
          }
        />
      ))}

      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="blue-spark"
          style={
            {
              left: spark.left,
              top: spark.top,
              width: spark.size,
              height: spark.size,
              animationDelay: spark.delay,
              "--spark-duration": spark.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
