"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  getCharacterTypeLore,
  getRegionLore,
  type CharacterTypeLoreEntry,
  type RegionLoreEntry,
} from "@/lib/runeterra-form-lore";

function RegionPreviewCard({ region, lore }: { region: string; lore: RegionLoreEntry }) {
  return (
    <motion.div
      key={region}
      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mt-3 overflow-hidden rounded-2xl border border-[#7eb6ff]/14 bg-black/30"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-[0_0_24px_rgba(71,132,211,0.12)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lore.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/70 via-transparent to-transparent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-title text-[0.72rem] uppercase tracking-[0.22em] text-[#7eb6ff]">{lore.mood}</p>
          <h3 className="mt-1 font-title text-base text-[#f7ebce]">{region}</h3>
          <p className="mt-1 text-xs leading-5 text-[#b8c9dd]">{lore.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

function CharacterTypePreviewCard({ characterType, lore }: { characterType: string; lore: CharacterTypeLoreEntry }) {
  return (
    <motion.div
      key={characterType}
      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mt-3 overflow-hidden rounded-2xl border border-[#c9a858]/14 bg-black/30"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#c9a858]/20 shadow-[0_0_24px_rgba(201,168,88,0.12)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lore.championImage} alt="" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/75 via-transparent to-transparent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-title text-[0.72rem] uppercase tracking-[0.22em] text-[#c9a858]">Exemplar champion</p>
          <h3 className="mt-1 font-title text-base text-[#f7ebce]">{lore.champion}</h3>
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[#9baabd]">{lore.championTitle}</p>
          <p className="mt-2 text-xs leading-5 text-[#b8c9dd]">{lore.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function RegionLorePreview({ region }: { region: string }) {
  const lore = getRegionLore(region);

  return (
    <AnimatePresence mode="wait">
      {lore ? <RegionPreviewCard key={region} region={region} lore={lore} /> : null}
    </AnimatePresence>
  );
}

export function CharacterTypeLorePreview({ characterType }: { characterType: string }) {
  const lore = getCharacterTypeLore(characterType);

  return (
    <AnimatePresence mode="wait">
      {lore ? <CharacterTypePreviewCard key={characterType} characterType={characterType} lore={lore} /> : null}
    </AnimatePresence>
  );
}
