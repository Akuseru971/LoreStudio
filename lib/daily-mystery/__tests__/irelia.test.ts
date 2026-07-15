import { describe, expect, it } from "vitest";
import { evaluateGuess } from "@/lib/daily-mystery/match";
import { tokenizePassage, toPublicTokens } from "@/lib/daily-mystery/tokenize";
import { IRELIA_PROTECTED_TERMS } from "@/lib/daily-mystery/__tests__/fixtures";
import { IRELIA_TEST_PASSAGE } from "@/content/daily-mystery/seed-manifest";

function evaluate(guess: string, revealed: Set<string> = new Set()) {
  const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
  return evaluateGuess({
    guess,
    tokens,
    canonicalTitle: "Irelia",
    acceptedAliases: ["the blade dancer", "xan irelia"],
    protectedTerms: IRELIA_PROTECTED_TERMS,
    alreadyRevealed: revealed,
    currentProximity: {},
  });
}

describe("Irelia mandatory puzzle behavior", () => {
  it("reveals Swain, Karma, and Ionia but not Darius", () => {
    const swain = evaluate("Swain");
    expect(swain.isCorrect).toBe(false);
    expect(swain.revealedTokenIds.length).toBeGreaterThan(0);
    expect(Object.values(swain.revealedTexts).join(" ")).toContain("Swain");

    const karma = evaluate("Karma");
    expect(karma.revealedTokenIds.length).toBeGreaterThan(0);
    expect(Object.values(karma.revealedTexts).join(" ")).toContain("Karma");

    const ionia = evaluate("Ionia");
    expect(ionia.revealedTokenIds.length).toBeGreaterThan(0);
    expect(Object.values(ionia.revealedTexts).join(" ")).toContain("Ionia");

    const darius = evaluate("Darius");
    expect(darius.isAbsent).toBe(true);
    expect(darius.revealedTokenIds).toHaveLength(0);
  });

  it("wins with Irelia without revealing Irelia through ordinary word matching", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const ireliaTokens = tokens.filter((token) => token.wordText === "Irelia");
    expect(ireliaTokens.length).toBeGreaterThan(0);
    expect(ireliaTokens.every((token) => token.isProtected)).toBe(true);

    const guess = evaluate("Irelia");
    expect(guess.isCorrect).toBe(true);
    expect(guess.isAbsent).toBe(false);
  });

  it("never exposes protected terms in pre-victory public payload", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const publicTokens = toPublicTokens(tokens, new Set(), {});

    const visibleText = publicTokens
      .filter((token) => token.revealed && token.text)
      .map((token) => token.text)
      .join(" ");

    expect(visibleText.toLowerCase()).not.toContain("irelia");
    expect(visibleText.toLowerCase()).not.toContain("blade dancer");

    const serialized = JSON.stringify({ tokens: publicTokens });
    expect(serialized.toLowerCase()).not.toContain("irelia");
    expect(serialized.toLowerCase()).not.toContain("xan irelia");
    expect(serialized.toLowerCase()).not.toContain("the blade dancer");
  });

  it("reveals other champion names as clues", () => {
    const swain = evaluate("Swain");
    const karma = evaluate("Karma");
    expect(swain.revealedTokenIds.length).toBeGreaterThan(0);
    expect(karma.revealedTokenIds.length).toBeGreaterThan(0);
    expect(swain.isCorrect).toBe(false);
    expect(karma.isCorrect).toBe(false);
  });

  it("protects The Blade Dancer phrase tokens", () => {
    const { tokens } = tokenizePassage(IRELIA_TEST_PASSAGE, IRELIA_PROTECTED_TERMS);
    const blade = tokens.find((token) => token.wordText === "Blade");
    const dancer = tokens.find((token) => token.wordText === "Dancer");
    expect(blade?.isProtected).toBe(true);
    expect(dancer?.isProtected).toBe(true);
  });

  it("reveals fought when guessing fight via lemma matching", () => {
    const passage = "They fought bravely.";
    const { tokens } = tokenizePassage(passage, []);
    const result = evaluateGuess({
      guess: "fight",
      tokens,
      canonicalTitle: "Hidden",
      acceptedAliases: [],
      protectedTerms: ["Hidden"],
      alreadyRevealed: new Set(),
      currentProximity: {},
    });
    expect(Object.values(result.revealedTexts).join(" ")).toContain("fought");
  });
});

describe("duplicate occurrences", () => {
  it("reveals every matching occurrence", () => {
    const passage = "Noxus struck Noxus again.";
    const { tokens } = tokenizePassage(passage, ["Target"]);
    const result = evaluateGuess({
      guess: "Noxus",
      tokens,
      canonicalTitle: "Target",
      acceptedAliases: [],
      protectedTerms: ["Target"],
      alreadyRevealed: new Set(),
      currentProximity: {},
    });
    expect(result.revealedTokenIds.length).toBe(2);
  });
});
