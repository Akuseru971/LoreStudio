import { createHash } from "crypto";
import type { MysteryProximityLevel, MysteryPuzzleToken, MysteryPublicToken } from "@/lib/daily-mystery/types";
import { lemmatizeEnglish, normalizeGuessToken, stripPossessive } from "@/lib/daily-mystery/normalize";

const WORD_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}'’\-]*$/u;
const PUNCTUATION_PATTERN = /^[^\p{L}\p{N}\s]+$/u;

function placeholderWidth(word: string) {
  const length = [...word].length;
  return Math.max(3, Math.min(14, Math.round(length * 0.72 + 2)));
}

function wordMatchesProtectedPart(
  normalized: string,
  lemma: string,
  part: string,
) {
  const partLemma = lemmatizeEnglish(part);
  return (
    normalized === part ||
    lemma === partLemma ||
    stripPossessive(normalized) === stripPossessive(part)
  );
}

function isProtectedWord(normalized: string, lemma: string, protectedTerms: string[]) {
  const protectedNormalized = protectedTerms.map((term) => normalizeGuessToken(term)).filter(Boolean);
  for (const term of protectedNormalized) {
    if (term.includes(" ")) {
      continue;
    }
    if (wordMatchesProtectedPart(normalized, lemma, term)) {
      return true;
    }
  }
  return false;
}

function markMultiWordProtectedPhrases(tokens: MysteryPuzzleToken[], protectedTerms: string[]) {
  const phrases = protectedTerms
    .map((term) => normalizeGuessToken(term))
    .filter((term) => term.includes(" "));

  for (const phrase of phrases) {
    const parts = phrase.split(" ").filter(Boolean);
    if (parts.length < 2) {
      continue;
    }

    for (let index = 0; index < tokens.length; index += 1) {
      let partIndex = 0;
      let cursor = index;
      const matchedIds: string[] = [];

      while (partIndex < parts.length && cursor < tokens.length) {
        const token = tokens[cursor];
        if (!token || token.type !== "word") {
          cursor += 1;
          continue;
        }

        const part = parts[partIndex]!;
        if (!token.normalized || !token.lemma || !wordMatchesProtectedPart(token.normalized, token.lemma, part)) {
          break;
        }

        matchedIds.push(token.id);
        partIndex += 1;
        cursor += 1;
      }

      if (partIndex === parts.length) {
        for (const id of matchedIds) {
          const token = tokens.find((entry) => entry.id === id);
          if (token) {
            token.isProtected = true;
          }
        }
      }
    }
  }
}

export function tokenizePassage(sourceText: string, protectedTerms: string[]) {
  const paragraphs = sourceText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const tokens: MysteryPuzzleToken[] = [];
  const paragraphTokenIds: string[][] = [];
  let tokenCounter = 0;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const ids: string[] = [];
    const parts = paragraph.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*|[^\p{L}\p{N}\s]+|\s+/gu) || [];

    for (const part of parts) {
      const id = `t${tokenCounter++}`;

      if (/^\s+$/.test(part)) {
        tokens.push({
          id,
          type: "whitespace",
          paragraphIndex,
          text: part,
          isProtected: false,
        });
        ids.push(id);
        continue;
      }

      if (PUNCTUATION_PATTERN.test(part)) {
        tokens.push({
          id,
          type: "punctuation",
          paragraphIndex,
          text: part,
          isProtected: false,
        });
        ids.push(id);
        continue;
      }

      if (WORD_PATTERN.test(part)) {
        const normalized = normalizeGuessToken(part);
        const lemma = lemmatizeEnglish(normalized);
        const protectedWord = isProtectedWord(normalized, lemma, protectedTerms);
        tokens.push({
          id,
          type: "word",
          paragraphIndex,
          wordText: part,
          normalized,
          lemma,
          isProtected: protectedWord,
          placeholderWidth: placeholderWidth(part),
        });
        ids.push(id);
      }
    }

    paragraphTokenIds.push(ids);
  });

  markMultiWordProtectedPhrases(tokens, protectedTerms);

  return { tokens, paragraphTokenIds };
}

export function toPublicTokens(
  tokens: MysteryPuzzleToken[],
  revealed: Set<string>,
  proximity: Record<string, MysteryProximityLevel | null | undefined>,
): MysteryPublicToken[] {
  return tokens.map((token) => {
    if (token.type !== "word") {
      return {
        id: token.id,
        type: token.type,
        paragraphIndex: token.paragraphIndex,
        text: token.text,
      };
    }

    const revealedNow = revealed.has(token.id);
    return {
      id: token.id,
      type: token.type,
      paragraphIndex: token.paragraphIndex,
      text: revealedNow ? token.wordText : undefined,
      placeholderWidth: token.placeholderWidth,
      proximity: revealedNow ? null : proximity[token.id] ?? null,
      revealed: revealedNow,
    };
  });
}

export function hashSourceText(text: string) {
  return createHash("sha256").update(text.trim()).digest("hex");
}

export function getUniqueLemmas(tokens: MysteryPuzzleToken[]) {
  const lemmas = new Set<string>();
  for (const token of tokens) {
    if (token.type === "word" && token.lemma && !token.isProtected) {
      lemmas.add(token.lemma);
    }
  }
  return [...lemmas];
}
