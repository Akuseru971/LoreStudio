"use client";

import { useMemo } from "react";

type MagicalBackgroundProps = {
  intensity?: "intro" | "form";
};

export default function MagicalBackground({ intensity = "intro" }: MagicalBackgroundProps) {
  const sparks = useMemo(
    () =>
      Array.from({ length: intensity === "intro" ? 34 : 22 }, (_, index) => ({
        id: index,
        left: `${(index * 29 + 11) % 100}%`,
        top: `${(index * 47 + 7) % 100}%`,
        delay: `${(index % 9) * 0.38}s`,
        duration: `${7 + (index % 6)}s`,
        size: `${2 + (index % 3)}px`,
      })),
    [intensity],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(70,118,180,0.18),transparent_26rem),radial-gradient(circle_at_22%_18%,rgba(126,182,255,0.12),transparent_18rem),radial-gradient(circle_at_78%_72%,rgba(32,65,122,0.18),transparent_22rem)]" />
      <div className="magical-smoke magical-smoke-a" />
      <div className="magical-smoke magical-smoke-b" />
      <div className="rune-glow absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />

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
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
