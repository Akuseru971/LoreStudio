"use client";

import { motion } from "framer-motion";
import type { LoreBook } from "@/lib/types";
import { getRegionSealClass } from "@/lib/ritual";

type CharacterRevealProps = {
  book: LoreBook;
};

type RevealLine = {
  label: string;
  value: string;
};

export default function CharacterReveal({ book }: CharacterRevealProps) {
  const bible = book.characterBible;
  const region = book.mainRegion || bible.region;

  const lines: RevealLine[] = [
    { label: "Name", value: bible.name },
    { label: "Region", value: region },
    { label: "Character Type", value: bible.characterType },
    { label: "Role", value: bible.socialRole || book.protagonistRole },
    ...(bible.legendaryTitle ? [{ label: "Legendary Title", value: bible.legendaryTitle }] : []),
    ...(book.coreConflict ? [{ label: "Core Conflict", value: book.coreConflict }] : []),
    ...(book.distinctiveHook
      ? [{ label: "Known for", value: book.distinctiveHook }]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="ritual-character-card relative overflow-hidden rounded-2xl border border-[#c9a858]/18 p-5 sm:p-6"
    >
      <div className={`ritual-region-seal ${getRegionSealClass(region)}`} aria-hidden="true" />
      <div className="relative z-10">
        <p className="font-title text-[0.58rem] uppercase tracking-[0.3em] text-[#a89068]/75">
          Character discovered
        </p>

        <div className="mt-4 space-y-3">
          {lines.map((line, index) => (
            <motion.div
              key={line.label}
              initial={{ opacity: 0, x: -12, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.65, ease: "easeOut", delay: 0.35 + index * 0.45 }}
              className="ritual-ink-line border-b border-white/[0.04] pb-2 last:border-0"
            >
              <p className="text-[0.58rem] uppercase tracking-[0.24em] text-[#7a8ea8]/70">{line.label}</p>
              <p className="font-cover-title mt-1 text-lg leading-snug text-[#e8dcc8]/90 sm:text-xl">
                {line.value}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
