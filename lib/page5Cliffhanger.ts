import "server-only";

import { findImmersionOffendingPhrases } from "@/lib/immersive-text";
import { openai } from "@/lib/server/openai";
import { TEXT_MODEL } from "@/lib/server/generation-config";
import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export const PAGE_5_CLIFFHANGER_ERROR = "Page 5 must end with a cliffhanger.";

function getLoreModel() {
  return TEXT_MODEL;
}

const RESOLVED_CONCLUSION_PATTERNS = [
  /\b(in the end|and so it was|from that day forward|years later|at last|found peace|made peace|learned to live|understood at last|accepted (?:their|his|her) fate)\b/i,
  /\b(that was enough|it was finished|nothing would change|the matter was closed|the story ended)\b/i,
  /\b(would always remember|never forgot|carried the memory|held the memory close)\b/i,
  /\b(a lesson|a truth to hold|a promise kept|a quiet victory)\b/i,
  /\b(and life went on|and so life|peace returned|the wound healed)\b/i,
];

const REFLECTIVE_WEAK_ENDING_PATTERNS = [
  /^(?:he|she|they)\s+(?:was|were)\s+(?:content|grateful|at peace|thankful)\b/i,
  /\b(remained|stayed)\s+(?:calm|silent|still|quiet|unmoved)\b/i,
  /\b(knew|understood|accepted)\s+that\b/i,
];

export function getLastSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const sentences = trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  if (!sentences?.length) {
    return trimmed;
  }

  return sentences[sentences.length - 1].trim();
}

export function replaceLastSentence(text: string, newLastSentence: string) {
  const trimmed = text.trim();
  const sentences = trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  if (!sentences?.length) {
    return newLastSentence.trim();
  }

  const prefix = sentences.slice(0, -1).join(" ").trim();
  const ending = newLastSentence.trim();
  if (!prefix) {
    return ending;
  }

  return `${prefix} ${ending}`.trim();
}

export function validatePage5Cliffhanger(pageFive?: { text?: string; title?: string }) {
  if (!pageFive?.text?.trim()) {
    return ["Page 5 is missing text."];
  }

  const text = pageFive.text.trim();
  const lastSentence = getLastSentence(text);
  const errors: string[] = [];

  const immersionPhrases = [
    ...findImmersionOffendingPhrases(text),
    ...findImmersionOffendingPhrases(lastSentence),
  ];
  if (immersionPhrases.length > 0) {
    console.error("[IMMERSION_VALIDATION_FAILED]", {
      pageNumber: 5,
      field: "text",
      offendingPhrases: Array.from(new Set(immersionPhrases)),
      textPreview: text.slice(0, 500),
    });
    errors.push("Page 5 contains immersion-breaking meta text.");
    return errors;
  }

  if (RESOLVED_CONCLUSION_PATTERNS.some((pattern) => pattern.test(lastSentence))) {
    errors.push(PAGE_5_CLIFFHANGER_ERROR);
    return errors;
  }

  if (REFLECTIVE_WEAK_ENDING_PATTERNS.some((pattern) => pattern.test(lastSentence))) {
    errors.push(PAGE_5_CLIFFHANGER_ERROR);
    return errors;
  }

  if (lastSentence.split(/\s+/).filter(Boolean).length < 4) {
    errors.push(PAGE_5_CLIFFHANGER_ERROR);
    return errors;
  }

  return errors;
}

export function isCliffhangerOnlyFailure(errors: string[]) {
  const cliffhangerErrors = errors.filter((error) => error === PAGE_5_CLIFFHANGER_ERROR);
  const otherErrors = errors.filter((error) => error !== PAGE_5_CLIFFHANGER_ERROR);
  return cliffhangerErrors.length > 0 && otherErrors.length === 0;
}

export function logPage5CliffhangerFailure(book: Partial<LoreBook>) {
  const pageFive = book.pages?.[4];
  console.error("[PAGE_5_CLIFFHANGER_VALIDATION_FAILED]", {
    page5Title: pageFive?.title,
    page5Text: pageFive?.text,
    lastSentence: getLastSentence(pageFive?.text || ""),
  });
}

function getResponseText(response: unknown) {
  const typed = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };

  if (typed.output_text?.trim()) {
    return typed.output_text;
  }

  return (
    typed.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  );
}

function extractJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Repair response did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function parseRepairedPage(rawText: string): BookPage {
  const parsed = JSON.parse(extractJson(rawText)) as Partial<BookPage>;
  if (!parsed.title?.trim() || !parsed.text?.trim() || !parsed.imagePrompt?.trim()) {
    throw new Error("Repaired page 5 is missing required fields.");
  }

  return {
    pageNumber: 5,
    chapter: parsed.chapter || "Chapter 5",
    title: parsed.title.trim(),
    text: parsed.text.trim(),
    imagePrompt: parsed.imagePrompt.trim(),
    visualDirection: parsed.visualDirection,
  };
}

export async function repairPage5Cliffhanger(book: Partial<LoreBook>, input: BookFormInput) {
  const model = getLoreModel();
  const championName = book.championConnection?.championName || "the connected champion";
  const pageFive = book.pages?.[4];

  const response = await openai.responses.create({
    model,
    instructions:
      "You rewrite only page 5 of an in-world Runeterra biography. Return only one valid JSON object. No markdown fences. No prose outside JSON.",
    input: `The generated book is almost valid, but page 5 does not end with a strong enough cliffhanger.

Rewrite only page 5.

Rules:
- Keep the same character: ${input.name}
- Keep the same region: ${book.region || input.runeterraRegion}
- Keep the same story continuity
- Keep the champion connection on page 5 with ${championName}
- Keep the page length between 55 and 95 words
- Do not mention page numbers in the visible text
- Do not mention payment, unlock, reader, AI, prompt, or story structure
- The final sentence must be a clear in-world cliffhanger
- The cliffhanger must make the reader want to know what happens next
- Return only the corrected page 5 JSON object

Current page 5:
${JSON.stringify(pageFive, null, 2)}

Champion connection:
${JSON.stringify(book.championConnection, null, 2)}

Expected output:
{
  "pageNumber": 5,
  "title": "...",
  "text": "...",
  "imagePrompt": "..."
}`,
    text: {
      format: { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 1200,
  });

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("Page 5 cliffhanger repair returned an empty response.");
  }

  return parseRepairedPage(rawText);
}

export async function repairPage5LastSentence(pageText: string) {
  const model = getLoreModel();
  const lastSentence = getLastSentence(pageText);

  const response = await openai.responses.create({
    model,
    instructions:
      "Rewrite only the final sentence of a biography page into a stronger in-world cliffhanger. Return only the rewritten final sentence. No quotes. No markdown.",
    input: `Rewrite only the final sentence of this page into a stronger cliffhanger.
Keep it immersive and in-world.
Do not mention pages, reader, payment, AI, or unlock.
Return only the rewritten final sentence.

Page text:
${pageText}

Current final sentence:
${lastSentence}`,
    text: {
      format: { type: "text" },
      verbosity: "medium",
    },
    max_output_tokens: 200,
  });

  const rewritten = getResponseText(response).replace(/^["']|["']$/g, "").trim();
  if (!rewritten) {
    throw new Error("Page 5 last-sentence repair returned an empty response.");
  }

  return rewritten;
}

export async function attemptPage5CliffhangerRepair(book: Partial<LoreBook>, input: BookFormInput) {
  const workingBook: Partial<LoreBook> = {
    ...book,
    pages: book.pages ? [...book.pages] : [],
  };

  logPage5CliffhangerFailure(workingBook);

  try {
    const repairedPage = await repairPage5Cliffhanger(workingBook, input);
    workingBook.pages![4] = repairedPage;

    const repairedErrors = validatePage5Cliffhanger(workingBook.pages![4]);
    if (!repairedErrors.includes(PAGE_5_CLIFFHANGER_ERROR)) {
      return workingBook;
    }
  } catch (error) {
    console.error("[PAGE_5_CLIFFHANGER_REPAIR_ERROR]", error);
  }

  const currentPageFive = workingBook.pages?.[4];
  if (!currentPageFive?.text) {
    throw new Error(PAGE_5_CLIFFHANGER_ERROR);
  }

  try {
    const rewrittenLastSentence = await repairPage5LastSentence(currentPageFive.text);
    workingBook.pages![4] = {
      ...currentPageFive,
      text: replaceLastSentence(currentPageFive.text, rewrittenLastSentence),
    };

    const finalErrors = validatePage5Cliffhanger(workingBook.pages![4]);
    if (finalErrors.includes(PAGE_5_CLIFFHANGER_ERROR)) {
      throw new Error(PAGE_5_CLIFFHANGER_ERROR);
    }

    return workingBook;
  } catch (error) {
    console.error("[PAGE_5_CLIFFHANGER_REPAIR_ERROR]", error);
    throw error instanceof Error ? error : new Error(PAGE_5_CLIFFHANGER_ERROR);
  }
}
