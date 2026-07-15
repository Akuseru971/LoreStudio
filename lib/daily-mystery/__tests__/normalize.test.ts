import { describe, expect, it } from "vitest";
import {
  isSolutionGuess,
  lemmatizeEnglish,
  normalizeGuessToken,
  stripPossessive,
  tokenizeGuess,
} from "@/lib/daily-mystery/normalize";

describe("normalizeGuessToken", () => {
  it("normalizes unicode apostrophes and whitespace", () => {
    expect(normalizeGuessToken("  Irelia’s  ")).toBe("irelia's");
    expect(normalizeGuessToken("Black   Rose")).toBe("black rose");
  });
});

describe("lemmatizeEnglish", () => {
  it("maps irregular verbs", () => {
    expect(lemmatizeEnglish("fought")).toBe("fight");
    expect(lemmatizeEnglish("invasions")).toBe("invasion");
  });

  it("does not treat substrings as lemmas", () => {
    expect(lemmatizeEnglish("invasion")).toBe("invasion");
    expect(lemmatizeEnglish("invade")).not.toBe("invasion");
  });
});

describe("tokenizeGuess", () => {
  it("supports multi-word guesses", () => {
    const result = tokenizeGuess("The Blade Dancer");
    expect(result.phraseParts).toEqual(["the", "blade", "dancer"]);
  });

  it("handles hyphenated terms", () => {
    expect(normalizeGuessToken("Noxus-born")).toBe("noxus-born");
  });
});

describe("stripPossessive", () => {
  it("strips possessive suffixes", () => {
    expect(stripPossessive("irelia's")).toBe("irelia");
    expect(stripPossessive("ionia's")).toBe("ionia");
  });
});

describe("isSolutionGuess", () => {
  it("accepts canonical title and aliases", () => {
    expect(
      isSolutionGuess("irelia", "Irelia", ["the blade dancer"], ["Irelia", "The Blade Dancer"]),
    ).toBe(true);
    expect(
      isSolutionGuess("the blade dancer", "Irelia", ["the blade dancer"], ["The Blade Dancer"]),
    ).toBe(true);
  });
});
