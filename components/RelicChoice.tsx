"use client";

import { motion } from "framer-motion";
import type { RelicName } from "@/lib/ritual";
import { cn } from "@/lib/utils";

type RelicChoiceProps = {
  relics: RelicName[];
  selected: string | null;
  onSelect: (relic: RelicName) => void;
};

const RELIC_ICONS: Record<string, string> = {
  "Broken Crown": "♛",
  "Blue Flame": "✦",
  "Ancient Blade": "⚔",
  "Watching Eye": "◉",
  "Silver Key": "⚷",
  "Drowned Coin": "◎",
  "Frost Rune": "❄",
  "Hextech Spark": "⚡",
  "Spirit Mask": "☽",
  "Sun Disk Fragment": "☀",
};

export default function RelicChoice({ relics, selected, onSelect }: RelicChoiceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="ritual-choice-panel"
    >
      <p className="font-title text-[0.58rem] uppercase tracking-[0.28em] text-[#a89068]/80">
        Choose the seal of your legend
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {relics.map((relic, index) => (
          <motion.button
            key={relic}
            type="button"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            onClick={() => onSelect(relic)}
            className={cn(
              "ritual-relic-option",
              selected === relic && "ritual-relic-option-selected",
            )}
          >
            <span className="ritual-relic-icon" aria-hidden="true">
              {RELIC_ICONS[relic] || "✧"}
            </span>
            <span className="ritual-relic-label">{relic}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
