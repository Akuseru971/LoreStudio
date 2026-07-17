import { evaluateGuess, mergeProximity } from "@/lib/daily-mystery/match";
import type { MysteryProximityLevel, MysteryPublicToken, MysteryPuzzleToken } from "@/lib/daily-mystery/types";
import { toPublicTokens } from "@/lib/daily-mystery/tokenize";

export type ReplayBoardState = {
  revealedIds: Set<string>;
  proximity: Record<string, MysteryProximityLevel | null>;
  guessCount: number;
  hintsUsed: number;
  isLocallySolved: boolean;
  feedback: string | null;
};

export function createInitialReplayState(): ReplayBoardState {
  return {
    revealedIds: new Set(),
    proximity: {},
    guessCount: 0,
    hintsUsed: 0,
    isLocallySolved: false,
    feedback: null,
  };
}

export function maskPublicTokens(tokens: MysteryPublicToken[]) {
  return tokens.map((token) =>
    token.type === "word"
      ? {
          ...token,
          revealed: false,
          text: undefined,
          proximity: null,
        }
      : token,
  );
}

export function buildReplayPublicTokens(
  internalTokens: MysteryPuzzleToken[],
  replayState: ReplayBoardState,
) {
  return toPublicTokens(internalTokens, replayState.revealedIds, replayState.proximity);
}

export function applyLocalReplayGuess({
  guess,
  internalTokens,
  canonicalTitle,
  protectedTerms,
  replayState,
}: {
  guess: string;
  internalTokens: MysteryPuzzleToken[];
  canonicalTitle: string;
  protectedTerms: string[];
  replayState: ReplayBoardState;
}) {
  const result = evaluateGuess({
    guess,
    tokens: internalTokens,
    canonicalTitle,
    acceptedAliases: [],
    protectedTerms,
    alreadyRevealed: replayState.revealedIds,
    currentProximity: replayState.proximity,
  });

  const revealedIds = new Set(replayState.revealedIds);
  for (const tokenId of result.revealedTokenIds) {
    revealedIds.add(tokenId);
  }

  let isLocallySolved = result.isCorrect;
  if (isLocallySolved) {
    for (const token of internalTokens) {
      if (token.type === "word") {
        revealedIds.add(token.id);
      }
    }
  }

  const proximity = isLocallySolved
    ? {}
    : mergeProximity(replayState.proximity, result.proximityUpdates);

  return {
    nextState: {
      revealedIds,
      proximity,
      guessCount: replayState.guessCount + 1,
      hintsUsed: replayState.hintsUsed,
      isLocallySolved,
      feedback: result.feedback,
    },
    revealedTokenIds: isLocallySolved
      ? internalTokens.filter((token) => token.type === "word" && !replayState.revealedIds.has(token.id)).map((token) => token.id)
      : result.revealedTokenIds,
    isVictory: isLocallySolved,
  };
}

export function hasMaskedTokens(tokens: MysteryPublicToken[]) {
  return tokens.some((token) => token.type === "word" && !token.revealed);
}

export function allWordTokensRevealed(tokens: MysteryPublicToken[]) {
  return !tokens.some((token) => token.type === "word" && !token.revealed);
}
