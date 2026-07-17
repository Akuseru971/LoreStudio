import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IRELIA_PROTECTED_TERMS, IRELIA_TEST_PASSAGE } from "@/lib/daily-mystery/__tests__/fixtures";
import { evaluateGuess, formatSemanticProximityArray, mergeProximity } from "@/lib/daily-mystery/match";
import {
  allWordTokensRevealed,
  applyLocalReplayGuess,
  buildReplayPublicTokens,
  createInitialReplayState,
  hasMaskedTokens,
} from "@/lib/daily-mystery/replay";
import { bucketFromSimilarity } from "@/lib/daily-mystery/semantic-math";
import { resolveDisplayRevealedIds, toPublicTokens, tokenizePassage } from "@/lib/daily-mystery/tokenize";

const CANONICAL = "Irelia";

describe("semantic proximity presentation", () => {
  it("formats safe semantic proximity entries without hidden words", () => {
    const formatted = formatSemanticProximityArray({
      token_a: "close",
      token_b: "warm",
    });

    expect(formatted).toEqual([
      { tokenId: "token_a", level: "close" },
      { tokenId: "token_b", level: "warm" },
    ]);
    expect(JSON.stringify(formatted)).not.toMatch(/Irelia|blade dancer/i);
  });

  it("upgrades proximity and never downgrades weaker later guesses", () => {
    const mergedWarm = mergeProximity({ token_a: "close" }, { token_a: "warm" });
    expect(mergedWarm.token_a).toBe("warm");

    const mergedDowngradeAttempt = mergeProximity({ token_a: "warm" }, { token_a: "close" });
    expect(mergedDowngradeAttempt.token_a).toBe("warm");
  });

  it("maps cosine similarity into close, warm, and very_close buckets", () => {
    expect(bucketFromSimilarity(0.9)).toBe("very_close");
    expect(bucketFromSimilarity(0.75)).toBe("warm");
    expect(bucketFromSimilarity(0.6)).toBe("close");
  });

  it("does not reveal words or trigger victory on semantic-only guesses", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const result = evaluateGuess({
      guess: "empire",
      tokens,
      canonicalTitle: CANONICAL,
      acceptedAliases: ["the blade dancer"],
      protectedTerms: IRELIA_PROTECTED_TERMS,
      alreadyRevealed: new Set(),
      currentProximity: {},
    });

    expect(result.isCorrect).toBe(false);
    expect(result.revealedTokenIds).toHaveLength(0);
  });
});

describe("victory full reveal", () => {
  it("reveals every word after victory while keeping pre-victory payloads masked", () => {
    const { tokens, paragraphTokenIds } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const partiallyRevealed = new Set(
      tokens.filter((token) => token.type === "word").slice(0, 2).map((token) => token.id),
    );

    const masked = toPublicTokens(tokens, partiallyRevealed, {});
    expect(hasMaskedTokens(masked)).toBe(true);
    expect(masked.some((token) => token.text === CANONICAL)).toBe(false);

    const solvedRevealed = resolveDisplayRevealedIds(tokens, [...partiallyRevealed], true);
    const solvedPublic = toPublicTokens(tokens, solvedRevealed, {});
    expect(allWordTokensRevealed(solvedPublic)).toBe(true);
    expect(solvedPublic.every((token) => token.type !== "word" || token.proximity == null)).toBe(true);
    expect(paragraphTokenIds.length).toBeGreaterThan(0);
  });

  it("still wins only on the exact canonical answer or alias", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    expect(
      evaluateGuess({
        guess: "Irelia",
        tokens,
        canonicalTitle: CANONICAL,
        acceptedAliases: ["the blade dancer"],
        protectedTerms: IRELIA_PROTECTED_TERMS,
        alreadyRevealed: new Set(),
        currentProximity: {},
      }).isCorrect,
    ).toBe(true);

    expect(
      evaluateGuess({
        guess: "empire",
        tokens,
        canonicalTitle: CANONICAL,
        acceptedAliases: ["the blade dancer"],
        protectedTerms: IRELIA_PROTECTED_TERMS,
        alreadyRevealed: new Set(),
        currentProximity: {},
      }).isCorrect,
    ).toBe(false);
  });
});

describe("replay and archive visibility", () => {
  it("resets local replay state without changing the official solved session", () => {
    const { tokens, paragraphTokenIds } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const replayState = createInitialReplayState();
    const masked = buildReplayPublicTokens(tokens, replayState);
    expect(hasMaskedTokens(masked)).toBe(true);

    const firstGuess = applyLocalReplayGuess({
      guess: "Swain",
      internalTokens: tokens,
      canonicalTitle: CANONICAL,
      protectedTerms: IRELIA_PROTECTED_TERMS,
      replayState,
    });
    expect(firstGuess.isVictory).toBe(false);
    expect(firstGuess.revealedTokenIds.length).toBeGreaterThan(0);

    const victory = applyLocalReplayGuess({
      guess: "Irelia",
      internalTokens: tokens,
      canonicalTitle: CANONICAL,
      protectedTerms: IRELIA_PROTECTED_TERMS,
      replayState: {
        ...firstGuess.nextState,
        revealedIds: firstGuess.nextState.revealedIds,
      },
    });
    expect(victory.isVictory).toBe(true);
    expect(allWordTokensRevealed(buildReplayPublicTokens(tokens, victory.nextState))).toBe(true);
    expect(paragraphTokenIds.length).toBeGreaterThan(0);
  });

  it("keeps normal exact word reveal behavior unchanged", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const result = evaluateGuess({
      guess: "Swain",
      tokens,
      canonicalTitle: CANONICAL,
      acceptedAliases: ["the blade dancer"],
      protectedTerms: IRELIA_PROTECTED_TERMS,
      alreadyRevealed: new Set(),
      currentProximity: {},
    });

    expect(result.isCorrect).toBe(false);
    expect(result.revealedTokenIds.length).toBeGreaterThan(0);
    expect(result.feedback).toContain("brightens");
  });

  it("hides the archive section from the daily mystery game UI", () => {
    const source = readFileSync(resolve(process.cwd(), "components/daily-mystery/DailyMysteryGame.tsx"), "utf8");
    expect(source).not.toContain('href="/daily-mystery/archive"');
    expect(source).not.toContain("Explore the Chronicle Archive");
    expect(source).toContain("Replay");
  });
});
