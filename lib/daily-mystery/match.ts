import type { MysteryPuzzleToken, MysteryProximityLevel } from "@/lib/daily-mystery/types";
import {
  buildProtectedTermSet,
  isProtectedTermGuess,
  isSolutionGuess,
  lemmatizeEnglish,
  normalizeGuessToken,
  stripPossessive,
  tokenizeGuess,
} from "@/lib/daily-mystery/normalize";

export type GuessMatchResult = {
  isCorrect: boolean;
  isAbsent: boolean;
  revealedTokenIds: string[];
  revealedTexts: Record<string, string>;
  proximityUpdates: Record<string, MysteryProximityLevel>;
  feedback: string;
};

function wordsMatch(guessLemma: string, guessNormalized: string, token: MysteryPuzzleToken) {
  if (token.type !== "word" || !token.lemma || !token.normalized) {
    return false;
  }

  if (token.isProtected) {
    return false;
  }

  const tokenLemma = token.lemma;
  const tokenNormalized = token.normalized;

  if (guessNormalized === tokenNormalized) {
    return true;
  }

  if (guessLemma === tokenLemma) {
    return true;
  }

  if (stripPossessive(guessNormalized) === stripPossessive(tokenNormalized)) {
    return true;
  }

  return false;
}

function phraseMatchesTokens(phraseParts: string[], tokens: MysteryPuzzleToken[], startIndex: number) {
  if (phraseParts.length === 0) {
    return false;
  }

  for (let offset = 0; offset < phraseParts.length; offset += 1) {
    const token = tokens[startIndex + offset];
    const part = phraseParts[offset];
    if (!token || token.type !== "word" || token.isProtected) {
      return false;
    }
    const partLemma = lemmatizeEnglish(part!);
    if (token.normalized !== part && token.lemma !== partLemma && stripPossessive(token.normalized || "") !== stripPossessive(part!)) {
      return false;
    }
  }

  return true;
}

export function findPhraseMatches(phraseParts: string[], tokens: MysteryPuzzleToken[]) {
  const matches: number[] = [];
  if (phraseParts.length === 0) {
    return matches;
  }

  for (let index = 0; index <= tokens.length - phraseParts.length; index += 1) {
    if (phraseMatchesTokens(phraseParts, tokens, index)) {
      matches.push(index);
    }
  }

  return matches;
}

export function evaluateGuess({
  guess,
  tokens,
  canonicalTitle,
  acceptedAliases,
  protectedTerms,
  alreadyRevealed,
  currentProximity,
}: {
  guess: string;
  tokens: MysteryPuzzleToken[];
  canonicalTitle: string;
  acceptedAliases: string[];
  protectedTerms: string[];
  alreadyRevealed: Set<string>;
  currentProximity: Record<string, MysteryProximityLevel>;
}): GuessMatchResult {
  const { normalized, lemma, phraseParts } = tokenizeGuess(guess);

  if (!normalized) {
    return {
      isCorrect: false,
      isAbsent: true,
      revealedTokenIds: [],
      revealedTexts: {},
      proximityUpdates: {},
      feedback: "Enter a word or guess the answer.",
    };
  }

  const protectedSet = buildProtectedTermSet(protectedTerms);

  if (isSolutionGuess(normalized, canonicalTitle, acceptedAliases, protectedTerms)) {
    const protectedTokenIds = tokens.filter((token) => token.isProtected).map((token) => token.id);
    const revealedTexts: Record<string, string> = {};
    for (const token of tokens) {
      if (token.type === "word" && token.wordText) {
        revealedTexts[token.id] = token.wordText;
      }
    }
    return {
      isCorrect: true,
      isAbsent: false,
      revealedTokenIds: protectedTokenIds,
      revealedTexts,
      proximityUpdates: {},
      feedback: "The Chronicle yields its hidden subject.",
    };
  }

  if (isProtectedTermGuess(normalized, protectedSet)) {
    const protectedTokenIds = tokens.filter((token) => token.isProtected).map((token) => token.id);
    const revealedTexts: Record<string, string> = {};
    for (const token of tokens) {
      if (token.isProtected && token.wordText) {
        revealedTexts[token.id] = token.wordText;
      }
    }
    return {
      isCorrect: true,
      isAbsent: false,
      revealedTokenIds: protectedTokenIds,
      revealedTexts,
      proximityUpdates: {},
      feedback: "The Chronicle yields its hidden subject.",
    };
  }

  const revealedTokenIds: string[] = [];
  const revealedTexts: Record<string, string> = {};

  if (phraseParts.length > 1) {
    const phraseStarts = findPhraseMatches(phraseParts, tokens);
    for (const start of phraseStarts) {
      for (let offset = 0; offset < phraseParts.length; offset += 1) {
        const token = tokens[start + offset];
        if (token && !alreadyRevealed.has(token.id) && token.wordText) {
          revealedTokenIds.push(token.id);
          revealedTexts[token.id] = token.wordText;
        }
      }
    }
  } else {
    for (const token of tokens) {
      if (alreadyRevealed.has(token.id)) {
        continue;
      }
      if (wordsMatch(lemma, normalized, token) && token.wordText) {
        revealedTokenIds.push(token.id);
        revealedTexts[token.id] = token.wordText;
      }
    }
  }

  if (revealedTokenIds.length > 0) {
    return {
      isCorrect: false,
      isAbsent: false,
      revealedTokenIds,
      revealedTexts,
      proximityUpdates: {},
      feedback: "A hidden line brightens in the Chronicle.",
    };
  }

  return {
    isCorrect: false,
    isAbsent: true,
    revealedTokenIds: [],
    revealedTexts: {},
    proximityUpdates: currentProximity,
    feedback: "This word does not appear in the Chronicle.",
  };
}

export function mergeProximity(
  current: Record<string, MysteryProximityLevel>,
  updates: Record<string, MysteryProximityLevel>,
) {
  const merged = { ...current };
  for (const [tokenId, level] of Object.entries(updates)) {
    if (!level) {
      continue;
    }
    const rank = { close: 1, warm: 2, very_close: 3 } as const;
    const existing = merged[tokenId];
    if (!existing || rank[level] > rank[existing]) {
      merged[tokenId] = level;
    }
  }
  return merged;
}

export function normalizeForComparison(value: string) {
  return normalizeGuessToken(value);
}
