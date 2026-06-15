"use client";

import { motion } from "framer-motion";
import { PHASE_TITLES, type RitualPhase } from "@/lib/ritual";

type RitualProgressProps = {
  phase: RitualPhase;
  progress: number;
};

const PHASE_STEPS: RitualPhase[] = ["archive", "character", "pages", "voice", "binding", "complete"];

export default function RitualProgress({ phase, progress }: RitualProgressProps) {
  const activeIndex = PHASE_STEPS.indexOf(phase);

  return (
    <div className="ritual-progress w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-title text-[0.62rem] uppercase tracking-[0.32em] text-[#a89068]/85">
          {PHASE_TITLES[phase]}
        </p>
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#7a8ea8]/70">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="ritual-progress-track">
        <motion.div
          className="ritual-progress-fill"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="mt-4 hidden gap-1 sm:flex">
        {PHASE_STEPS.slice(0, -1).map((step, index) => (
          <div
            key={step}
            className={`ritual-progress-step ${index <= activeIndex ? "ritual-progress-step-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
