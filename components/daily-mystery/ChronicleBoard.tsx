"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import type { MysteryProximityLevel, MysteryPublicToken } from "@/lib/daily-mystery/types";

type ChronicleBoardProps = {
  tokens: MysteryPublicToken[];
  paragraphTokenIds: string[][];
  newlyRevealedIds?: string[];
  victoryAnimating?: boolean;
  victoryAnswer?: string | null;
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

export default function ChronicleBoard({
  tokens,
  paragraphTokenIds,
  newlyRevealedIds = [],
  victoryAnimating = false,
  victoryAnswer = null,
}: ChronicleBoardProps) {
  const reduceMotion = useReducedMotion();
  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const revealSet = new Set(newlyRevealedIds);
  const revealOrder = useMemo(() => new Map(newlyRevealedIds.map((id, index) => [id, index])), [newlyRevealedIds]);

  return (
    <div
      className={`chronicle-board${victoryAnimating ? " chronicle-board--victory" : ""}${reduceMotion ? " chronicle-board--reduced-motion" : ""}`}
      aria-label="Hidden Chronicle passage"
    >
      {victoryAnimating ? (
        <div className="chronicle-victory-atmosphere" aria-hidden="true">
          <div className="chronicle-victory-mist" />
          {victoryAnswer ? <p className="chronicle-victory-answer">{victoryAnswer}</p> : null}
        </div>
      ) : null}

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
            const revealIndex = revealOrder.get(token.id) ?? 0;
            const revealDelayMs = reduceMotion ? 0 : Math.min(revealIndex, 5) * 45;

            if (token.revealed && token.text) {
              return (
                <span
                  key={token.id}
                  className={`chronicle-word revealed${isNew ? " chronicle-word--emerging" : ""}${victoryAnimating ? " chronicle-word--victory-glow" : ""}`}
                  style={isNew && !reduceMotion ? { animationDelay: `${revealDelayMs}ms` } : undefined}
                >
                  {token.text}
                </span>
              );
            }

            return (
              <span
                key={token.id}
                className={`chronicle-placeholder ${proximityClass(token.proximity)}${victoryAnimating ? " chronicle-placeholder--victory-illuminate" : ""}`}
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
