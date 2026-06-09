"use client";

import { motion } from "framer-motion";
import MagicalBackground from "@/components/MagicalBackground";

type IntroGateProps = {
  onStart: () => void;
};

export default function IntroGate({ onStart }: IntroGateProps) {
  return (
    <main
      className="archive-shell relative flex min-h-screen cursor-pointer items-center justify-center overflow-hidden px-5"
      onClick={onStart}
    >
      <MagicalBackground intensity="intro" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, filter: "blur(14px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 1.04, filter: "blur(18px)" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative z-10 text-center"
      >
        <motion.button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onStart();
          }}
          animate={{
            textShadow: [
              "0 0 18px rgba(126,182,255,0.34)",
              "0 0 34px rgba(126,182,255,0.72)",
              "0 0 18px rgba(126,182,255,0.34)",
            ],
            opacity: [0.82, 1, 0.82],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="font-title rounded-full border border-[#7eb6ff]/20 bg-[#081225]/25 px-8 py-4 text-3xl tracking-[0.22em] text-[#dcecff] shadow-[0_0_80px_rgba(71,132,211,0.16)] backdrop-blur-md transition hover:border-[#9fc8ff]/45 hover:bg-[#0c1930]/40 sm:text-5xl"
        >
          Click to start
        </motion.button>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.72, y: 0 }}
          transition={{ delay: 0.65, duration: 0.9 }}
          className="mt-5 text-sm uppercase tracking-[0.32em] text-[#9fb8d8]"
        >
          The archives are waiting.
        </motion.p>
      </motion.div>
    </main>
  );
}
