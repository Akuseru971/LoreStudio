"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { CSSProperties } from "react";

type BookAtmosphereProps = {
  intensity?: "closed" | "opening" | "open";
};

export default function BookAtmosphere({ intensity = "closed" }: BookAtmosphereProps) {
  const sparks = useMemo(
    () =>
      Array.from({ length: intensity === "open" ? 8 : 14 }, (_, index) => ({
        id: index,
        left: `${8 + ((index * 23) % 84)}%`,
        top: `${12 + ((index * 31) % 76)}%`,
        delay: `${index * 0.45}s`,
        duration: `${6 + (index % 5)}s`,
        size: `${1.5 + (index % 2.5)}px`,
      })),
    [intensity],
  );

  const smokeOpacity = intensity === "open" ? 0.45 : intensity === "opening" ? 0.72 : 0.85;

  return (
    <div className="book-atmosphere" aria-hidden="true">
      <motion.div
        className="book-atmosphere-vignette"
        animate={{ opacity: smokeOpacity }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      <motion.div
        className="book-smoke book-smoke-a"
        animate={{ x: [0, 18, -8, 0], y: [0, -12, 8, 0], opacity: [0.5, 0.7, 0.55, 0.5] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="book-smoke book-smoke-b"
        animate={{ x: [0, -22, 10, 0], y: [0, 14, -10, 0], opacity: [0.35, 0.55, 0.4, 0.35] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="book-smoke book-smoke-c"
        animate={{ x: [0, 12, -16, 0], y: [0, -8, 12, 0], opacity: [0.28, 0.42, 0.32, 0.28] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="book-atmosphere-glow" />

      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="book-atmosphere-spark"
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
