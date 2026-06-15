"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FinalQuoteChoiceProps = {
  quotes: string[];
  selected: string | null;
  onSelect: (quote: string) => void;
};

export default function FinalQuoteChoice({ quotes, selected, onSelect }: FinalQuoteChoiceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
      className="ritual-choice-panel"
    >
      <p className="font-title text-[0.58rem] uppercase tracking-[0.28em] text-[#a89068]/80">
        Choose the line that closes your legend
      </p>
      <div className="mt-3 space-y-2">
        {quotes.map((quote, index) => (
          <motion.button
            key={quote}
            type="button"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.45 }}
            onClick={() => onSelect(quote)}
            className={cn(
              "ritual-quote-option w-full text-left",
              selected === quote && "ritual-quote-option-selected",
            )}
          >
            <span className="font-cover-title text-sm italic leading-relaxed text-[#d4c4a0]/88 sm:text-base">
              “{quote}”
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
