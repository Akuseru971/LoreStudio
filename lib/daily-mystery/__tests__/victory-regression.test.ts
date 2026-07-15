import { describe, expect, it } from "vitest";
import { evaluateGuess } from "@/lib/daily-mystery/match";
import { tokenizePassage } from "@/lib/daily-mystery/tokenize";
import { IRELIA_PROTECTED_TERMS } from "@/lib/daily-mystery/__tests__/fixtures";
import { IRELIA_TEST_PASSAGE } from "@/content/daily-mystery/seed-manifest";

const CANONICAL = "Irelia";
const ALIASES = ["the blade dancer", "xan irelia"];

function evaluate(guess: string, revealed: Set<string> = new Set()) {
  const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
  return evaluateGuess({
    guess,
    tokens,
    canonicalTitle: CANONICAL,
    acceptedAliases: ALIASES,
    protectedTerms: IRELIA_PROTECTED_TERMS,
    alreadyRevealed: revealed,
    currentProximity: {},
  });
}

describe("false victory regression", () => {
  const unrelatedGuesses = ["Swain", "Karma", "Noxus", "random", "hello", "world"];

  it("does not win after three unrelated guesses", () => {
    const revealed = new Set<string>();
    for (const guess of unrelatedGuesses.slice(0, 3)) {
      const result = evaluate(guess, revealed);
      expect(result.isCorrect).toBe(false);
      for (const tokenId of result.revealedTokenIds) {
        revealed.add(tokenId);
      }
    }
    expect(revealed.size).toBeGreaterThanOrEqual(0);
  });

  it("does not win after many unrelated guesses", () => {
    for (const guess of unrelatedGuesses) {
      const result = evaluate(guess);
      expect(result.isCorrect).toBe(false);
    }
  });

  it("does not win when guessing protected phrase fragments", () => {
    expect(evaluate("blade").isCorrect).toBe(false);
    expect(evaluate("dancer").isCorrect).toBe(false);
    expect(evaluate("blade dancer").isCorrect).toBe(false);
    expect(evaluate("the").isCorrect).toBe(false);
  });

  it("does not win on partial substring of the answer", () => {
    expect(evaluate("ire").isCorrect).toBe(false);
    expect(evaluate("ireli").isCorrect).toBe(false);
  });

  it("wins only on canonical title or explicit aliases", () => {
    expect(evaluate("Irelia").isCorrect).toBe(true);
    expect(evaluate("the blade dancer").isCorrect).toBe(true);
    expect(evaluate("xan irelia").isCorrect).toBe(true);
  });

  it("reveals other champion names without victory", () => {
    const swain = evaluate("Swain");
    const karma = evaluate("Karma");
    expect(swain.isCorrect).toBe(false);
    expect(karma.isCorrect).toBe(false);
    expect(swain.revealedTokenIds.length).toBeGreaterThan(0);
    expect(karma.revealedTokenIds.length).toBeGreaterThan(0);
  });
});
