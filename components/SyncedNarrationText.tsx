"use client";

import { motion } from "framer-motion";

type SyncedNarrationTextProps = {
  text: string;
  isActive: boolean;
  audioDuration?: number;
  narrationStarted: boolean;
};

export default function SyncedNarrationText({
  text,
  isActive,
  audioDuration,
  narrationStarted,
}: SyncedNarrationTextProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const estimatedDuration = Math.max(6, words.length * 0.38);
  const duration = audioDuration && audioDuration > 0 ? audioDuration : estimatedDuration;
  const delayPerWord = Math.min(0.18, Math.max(0.04, duration / Math.max(words.length, 1)));

  if (!narrationStarted) {
    return (
      <p className="font-manuscript mt-5 text-[1.1rem] leading-[1.8] tracking-wide text-[#5a4024]/75 sm:text-[1.22rem]">
        The narrator draws breath. The ink waits for the voice.
      </p>
    );
  }

  return (
    <p className="font-manuscript mt-5 text-[1.1rem] leading-[1.8] tracking-wide text-[#2f2419] sm:text-[1.22rem]">
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, x: -4, filter: "blur(3px)" }}
          animate={isActive ? { opacity: 1, x: 0, filter: "blur(0px)" } : { opacity: 0.65, x: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.35,
            delay: isActive ? index * delayPerWord : 0,
            ease: "easeOut",
          }}
          className="smokey-word inline-block"
        >
          {word}
          {index < words.length - 1 ? "\u00a0" : ""}
        </motion.span>
      ))}
    </p>
  );
}
