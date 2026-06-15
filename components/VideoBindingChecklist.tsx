"use client";

import { motion } from "framer-motion";
import { BINDING_CHECKLIST } from "@/lib/ritual";
import { cn } from "@/lib/utils";

type VideoBindingChecklistProps = {
  loreReady: boolean;
  imagesReadyCount: number;
  totalImages: number;
  audioReadyCount: number;
  totalAudio: number;
  bookReady: boolean;
  videoReady: boolean;
};

export default function VideoBindingChecklist({
  loreReady,
  imagesReadyCount,
  totalImages,
  audioReadyCount,
  totalAudio,
  bookReady,
  videoReady,
}: VideoBindingChecklistProps) {
  const states: Record<string, "done" | "active" | "pending"> = {
    lore: loreReady ? "done" : "active",
    images: imagesReadyCount >= totalImages ? "done" : loreReady ? "active" : "pending",
    audio: audioReadyCount >= totalAudio ? "done" : imagesReadyCount > 0 ? "active" : "pending",
    voice: audioReadyCount >= totalAudio ? "done" : audioReadyCount > 0 ? "active" : "pending",
    book: bookReady ? "done" : audioReadyCount >= totalAudio ? "active" : "pending",
    video: videoReady ? "done" : bookReady ? "active" : "pending",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      className="ritual-binding-checklist"
    >
      <ul className="space-y-2.5">
        {BINDING_CHECKLIST.map((item, index) => {
          const state = states[item.id];
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className={cn(
                "ritual-checklist-item",
                state === "done" && "ritual-checklist-done",
                state === "active" && "ritual-checklist-active",
              )}
            >
              <span className="ritual-checklist-mark" aria-hidden="true">
                {state === "done" ? "✓" : state === "active" ? "◌" : "·"}
              </span>
              <span>{item.label}</span>
              {item.id === "video" && state === "active" && !videoReady ? (
                <span className="ml-2 text-[0.55rem] uppercase tracking-[0.18em] text-[#7a8ea8]/60">
                  preview
                </span>
              ) : null}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
