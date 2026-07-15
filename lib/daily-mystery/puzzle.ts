import "server-only";

import { cache } from "react";
import type { MysteryContentItem, MysteryPublicToken } from "@/lib/daily-mystery/types";
import { tokenizePassage, toPublicTokens } from "@/lib/daily-mystery/tokenize";

export type BuiltPuzzle = {
  tokens: ReturnType<typeof tokenizePassage>["tokens"];
  paragraphTokenIds: string[][];
  publicTokens: MysteryPublicToken[];
};

const puzzleCache = new Map<string, ReturnType<typeof tokenizePassage>>();

export function clearDailyMysteryPuzzleCache() {
  puzzleCache.clear();
}

export function buildPuzzleFromContent(content: MysteryContentItem) {
  const cacheKey = `${content.id}:${content.source_hash}`;
  let tokenized = puzzleCache.get(cacheKey);
  if (!tokenized) {
    tokenized = tokenizePassage(content.source_text, content.protected_terms);
    puzzleCache.set(cacheKey, tokenized);
  }

  return tokenized;
}

export function buildPublicPuzzleView(
  content: MysteryContentItem,
  revealedTokenIds: string[],
  tokenProximity: Record<string, MysteryPublicToken["proximity"]>,
) {
  const { tokens, paragraphTokenIds } = buildPuzzleFromContent(content);
  const revealed = new Set(revealedTokenIds);
  const publicTokens = toPublicTokens(tokens, revealed, tokenProximity);
  return {
    tokens,
    paragraphTokenIds,
    publicTokens,
  };
}

export const getCachedPuzzleTokens = cache((contentId: string, sourceHash: string, sourceText: string, protectedTerms: string[]) => {
  return tokenizePassage(sourceText, protectedTerms);
});
