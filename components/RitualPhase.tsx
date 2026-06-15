"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { PHASE_TITLES, type RitualPhase } from "@/lib/ritual";

type RitualPhaseProps = {
  phase: RitualPhase;
  message: string;
  children?: ReactNode;
};

export default function RitualPhase({ phase, message, children }: RitualPhaseProps) {
  return (
    <section className="ritual-phase relative z-10 w-full">
      <div className="mb-6 min-h-[4.5rem] text-center">
        <p className="font-title text-[0.65rem] uppercase tracking-[0.36em] text-[#c9a858]/75">
          {PHASE_TITLES[phase]}
        </p>
        <AnimatePresence mode="wait">
          <motion.h2
            key={message}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="font-cover-title mt-3 text-2xl leading-snug text-[#e8dcc8]/92 sm:text-3xl"
          >
            {message}
          </motion.h2>
        </AnimatePresence>
      </div>
      {children}
    </section>
  );
}
