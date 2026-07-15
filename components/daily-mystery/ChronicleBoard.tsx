"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MysteryProximityLevel, MysteryPublicToken } from "@/lib/daily-mystery/types";

type ChronicleBoardProps = {
  tokens: MysteryPublicToken[];
  paragraphTokenIds: string[][];
  newlyRevealedIds?: string[];
};

function proximityClass(level: MysteryProximityLevel | null | undefined) {
  if (level === "very_close") {
    return "chronicle-proximity-very-close";
  }
  if (level === "warm") {
    return "chronicle-proximity-warm";
  }
  if (level === "close") {
    return "chronicle-proximity-close";
  }
  return "";
}

function proximityLabel(level: MysteryProximityLevel | null | undefined) {
  if (level === "very_close") {
    return "Very close";
  }
  if (level === "warm") {
    return "Warm";
  }
  if (level === "close") {
    return "Close";
  }
  return null;
}

export default function ChronicleBoard({ tokens, paragraphTokenIds, newlyRevealedIds = [] }: ChronicleBoardProps) {
  const reduceMotion = useReducedMotion();
  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const revealSet = new Set(newlyRevealedIds);

  return (
    <div className="chronicle-board" aria-label="Hidden Chronicle passage">
      {paragraphTokenIds.map((paragraph, paragraphIndex) => (
        <p key={`paragraph-${paragraphIndex}`} className="chronicle-paragraph">
          {paragraph.map((tokenId) => {
            const token = tokenMap.get(tokenId);
            if (!token) {
              return null;
            }

            if (token.type === "whitespace") {
              return <span key={token.id}>{token.text}</span>;
            }

            if (token.type === "punctuation") {
              return (
                <span key={token.id} className="chronicle-punctuation">
                  {token.text}
                </span>
              );
            }

            const proximity = proximityLabel(token.proximity);
            const isNew = revealSet.has(token.id);

            if (token.revealed && token.text) {
              return (
                <motion.span
                  key={token.id}
                  className="chronicle-word revealed"
                  initial={reduceMotion || !isNew ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {token.text}
                </motion.span>
              );
            }

            return (
              <span
                key={token.id}
                className={`chronicle-placeholder ${proximityClass(token.proximity)}`}
                style={{ width: `${token.placeholderWidth ?? 4}ch` }}
                aria-label={proximity ? `${proximity} semantic match` : "Hidden word"}
                title={proximity ?? undefined}
              >
                <span className="chronicle-placeholder-bar" aria-hidden="true" />
                {proximity ? <span className="sr-only">{proximity}</span> : null}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
