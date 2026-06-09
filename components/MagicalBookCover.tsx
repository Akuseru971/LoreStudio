"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import BookAtmosphere from "@/components/BookAtmosphere";
import { cn } from "@/lib/utils";

type MagicalBookCoverProps = {
  bookState: "closed" | "opening" | "open";
  openingDurationMs: number;
  onOpen: () => void;
  escapeParticles: Array<{
    id: number;
    left: string;
    top: string;
  }>;
};

function CoverFiligree() {
  return (
    <svg
      className="enchanted-cover-filigree"
      viewBox="0 0 320 480"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0d890" />
          <stop offset="35%" stopColor="#c9a84e" />
          <stop offset="68%" stopColor="#8a6b2e" />
          <stop offset="100%" stopColor="#e8c878" />
        </linearGradient>
        <linearGradient id="goldFiligreeDim" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6e5428" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#b89448" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#4a3820" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="medallionGlow" cx="50%" cy="42%" r="50%">
          <stop offset="0%" stopColor="#2a3548" />
          <stop offset="55%" stopColor="#141c28" />
          <stop offset="100%" stopColor="#0a0e14" />
        </radialGradient>
        <filter id="filigreeEmboss">
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#000" floodOpacity="0.65" />
          <feDropShadow dx="0" dy="-0.5" stdDeviation="0.4" floodColor="#fff8d0" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Outer ornate border frame */}
      <rect x="18" y="22" width="284" height="436" rx="8" fill="none" stroke="url(#goldFiligree)" strokeWidth="1.8" opacity="0.85" />
      <rect x="28" y="34" width="264" height="412" rx="6" fill="none" stroke="url(#goldFiligreeDim)" strokeWidth="0.9" opacity="0.7" />

      {/* Corner flourishes */}
      <path
        d="M38 48 C58 38, 72 42, 82 62 C72 52, 58 48, 38 48 Z M38 48 C48 58, 52 72, 38 88 C42 72, 42 58, 38 48 Z"
        fill="url(#goldFiligree)"
        opacity="0.82"
        filter="url(#filigreeEmboss)"
      />
      <path
        d="M282 48 C262 38, 248 42, 238 62 C248 52, 262 48, 282 48 Z M282 48 C272 58, 268 72, 282 88 C278 72, 278 58, 282 48 Z"
        fill="url(#goldFiligree)"
        opacity="0.82"
        filter="url(#filigreeEmboss)"
      />
      <path
        d="M38 432 C58 442, 72 438, 82 418 C72 428, 58 432, 38 432 Z M38 432 C48 422, 52 408, 38 392 C42 408, 42 422, 38 432 Z"
        fill="url(#goldFiligree)"
        opacity="0.82"
        filter="url(#filigreeEmboss)"
      />
      <path
        d="M282 432 C262 442, 248 438, 238 418 C248 428, 262 432, 282 432 Z M282 432 C272 422, 268 408, 282 392 C278 408, 278 422, 282 432 Z"
        fill="url(#goldFiligree)"
        opacity="0.82"
        filter="url(#filigreeEmboss)"
      />

      {/* Vine filigree — left */}
      <path
        d="M52 120 C48 180, 44 240, 52 300 C56 340, 48 380, 56 420
           M52 140 C68 160, 72 200, 64 240 C58 270, 70 310, 60 350
           M64 180 C78 188, 82 210, 74 228 C68 242, 80 258, 72 278"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.78"
        filter="url(#filigreeEmboss)"
      />
      {/* Vine filigree — right */}
      <path
        d="M268 110 C272 170, 276 230, 268 290 C264 330, 272 370, 264 410
           M268 150 C252 168, 248 208, 256 248 C262 278, 250 318, 260 358
           M256 200 C242 208, 238 230, 246 248 C252 262, 240 278, 248 298"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.78"
        filter="url(#filigreeEmboss)"
      />
      {/* Top & bottom scrollwork */}
      <path
        d="M90 56 C120 42, 200 42, 230 56 C210 48, 110 48, 90 56 Z
           M100 68 C130 58, 190 58, 220 68"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="1.2"
        opacity="0.72"
      />
      <path
        d="M88 424 C118 438, 202 438, 232 424 C212 432, 108 432, 88 424 Z
           M98 412 C128 422, 192 422, 222 412"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="1.2"
        opacity="0.72"
      />

      {/* Central medallion plate */}
      <ellipse cx="160" cy="205" rx="78" ry="88" fill="url(#medallionGlow)" stroke="url(#goldFiligree)" strokeWidth="2" opacity="0.95" />
      <ellipse cx="160" cy="205" rx="62" ry="72" fill="none" stroke="url(#goldFiligreeDim)" strokeWidth="1" opacity="0.65" />
      <path
        d="M160 128 C195 145, 215 175, 215 210 C215 248, 192 278, 160 292
           C128 278, 105 248, 105 210 C105 175, 125 145, 160 128 Z"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="1.1"
        opacity="0.55"
      />

      {/* Swirling inner ornament */}
      <path
        d="M160 168 C178 172, 188 188, 184 206 C180 224, 164 234, 148 228
           C132 222, 126 204, 134 188 C142 172, 160 168, 160 168
           M160 188 C170 190, 176 198, 174 208 C172 218, 164 224, 154 220"
        fill="none"
        stroke="url(#goldFiligree)"
        strokeWidth="0.9"
        opacity="0.6"
      />
    </svg>
  );
}

function GemAccent({
  className,
  size = "sm",
  tone = "sapphire",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "sapphire" | "ruby" | "emerald";
}) {
  const tones = {
    sapphire: { core: "#4a8fd4", glow: "#7eb8ff", rim: "#2a5a8a" },
    ruby: { core: "#a84868", glow: "#e87898", rim: "#6a2848" },
    emerald: { core: "#3a8868", glow: "#68c8a0", rim: "#1a5840" },
  };
  const palette = tones[tone];
  const dimensions = { sm: "0.55rem", md: "0.85rem", lg: "1.35rem" };

  return (
    <span
      className={cn("enchanted-gem", `enchanted-gem-${size}`, className)}
      style={
        {
          width: dimensions[size],
          height: dimensions[size],
          "--gem-core": palette.core,
          "--gem-glow": palette.glow,
          "--gem-rim": palette.rim,
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

export default function MagicalBookCover({
  bookState,
  openingDurationMs,
  onOpen,
  escapeParticles,
}: MagicalBookCoverProps) {
  const isOpening = bookState === "opening";

  return (
    <div className="enchanted-tome-presentation">
      <BookAtmosphere intensity={isOpening ? "opening" : "closed"} />

      <motion.div
        className="enchanted-tome-stage"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="enchanted-tome">
          <div className="enchanted-tome-shadow" aria-hidden="true" />
          <div className="enchanted-tome-spine" aria-hidden="true" />
          <div className="enchanted-tome-pages" aria-hidden="true" />
          <div className="enchanted-tome-bookmark" aria-hidden="true" />

          <motion.button
            type="button"
            onClick={onOpen}
            disabled={isOpening}
            aria-label={isOpening ? "The archive awakens" : "Open the book"}
            animate={
              isOpening
                ? {
                    rotateY: -20,
                    boxShadow:
                      "0 4px 0 rgba(200,180,120,0.06) inset, 0 60px 130px rgba(0,0,0,0.85), 0 0 90px rgba(71,132,211,0.32), inset -22px 0 44px rgba(0,0,0,0.58)",
                  }
                : { rotateY: 0 }
            }
            transition={{ duration: openingDurationMs / 1000, ease: [0.22, 1, 0.36, 1] }}
            className="enchanted-tome-cover"
          >
            <div className="enchanted-cover-base" aria-hidden="true" />
            <div className="enchanted-cover-leather" aria-hidden="true" />
            <CoverFiligree />

            {/* Jewel accents */}
            <GemAccent className="enchanted-gem-tl" size="sm" tone="sapphire" />
            <GemAccent className="enchanted-gem-tr" size="sm" tone="ruby" />
            <GemAccent className="enchanted-gem-bl" size="sm" tone="emerald" />
            <GemAccent className="enchanted-gem-br" size="sm" tone="sapphire" />
            <GemAccent className="enchanted-gem-mid-l" size="sm" tone="emerald" />
            <GemAccent className="enchanted-gem-mid-r" size="sm" tone="ruby" />

            {/* Central medallion & gem */}
            <div className="enchanted-medallion" aria-hidden="true">
              <div className="enchanted-medallion-plate" />
              <GemAccent size="lg" tone="sapphire" />
              <div className="enchanted-medallion-ring" />
            </div>

            <div className="enchanted-cover-clasp" aria-hidden="true" />

            <motion.div
              className="enchanted-opening-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: isOpening ? 1 : 0 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              aria-hidden="true"
            />
            <motion.div
              className="enchanted-light-leak"
              initial={{ opacity: 0, scaleX: 0.2 }}
              animate={isOpening ? { opacity: [0, 1, 0.45], scaleX: 1 } : { opacity: 0, scaleX: 0.2 }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
              aria-hidden="true"
            />

            {isOpening
              ? escapeParticles.map((particle) => (
                  <motion.span
                    key={`escape-${particle.id}`}
                    className="enchanted-escape-particle"
                    style={{ left: particle.left, top: particle.top }}
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 0.95, 0], y: -48, x: 14 }}
                    transition={{
                      duration: 1.7,
                      delay: particle.id * 0.1,
                      ease: "easeOut",
                    }}
                    aria-hidden="true"
                  />
                ))
              : null}

            <div className="enchanted-cover-highlight" aria-hidden="true" />
          </motion.button>
        </div>
      </motion.div>

      <motion.p
        className="enchanted-tome-cta"
        animate={{ opacity: isOpening ? 0.5 : 1 }}
        transition={{ duration: 0.6 }}
      >
        {isOpening ? "The archive awakens" : "Open the book"}
      </motion.p>
    </div>
  );
}
