import "server-only";

import { openai } from "@/lib/server/openai";
import { BOOK_TEXT_MODEL } from "@/lib/server/ai-config";
import type { ApprovedSynopsis, BookFormInput, BookPage, ChampionConnection, LoreBook } from "@/lib/types";

export const PAGE_5_CLIFFHANGER_ERROR = "Page 5 must end with a cliffhanger.";
export const PAGE_5_CHAMPION_CONNECTION_ERROR = "Page 5 must reference the chosen champion connection.";

const CHAMPION_REFERENCE_STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "because",
  "champion",
  "connection",
  "during",
  "their",
  "there",
  "these",
  "those",
  "through",
  "under",
  "where",
  "which",
  "while",
  "world",
  "would",
]);

function getBookTextModel() {
  return BOOK_TEXT_MODEL;
}

const IMMERSION_BANNED_PATTERN =
  /\b(page\s*\d+|previous page|next page|this page|chapter|unlock|payment|reader|generated|prompt|ai)\b/i;

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

  if (IMMERSION_BANNED_PATTERN.test(lastSentence) || IMMERSION_BANNED_PATTERN.test(text)) {
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

export function isChampionConnectionOnlyFailure(errors: string[]) {
  const championErrors = errors.filter((error) => error === PAGE_5_CHAMPION_CONNECTION_ERROR);
  const otherErrors = errors.filter((error) => error !== PAGE_5_CHAMPION_CONNECTION_ERROR);
  return championErrors.length > 0 && otherErrors.length === 0;
}

const PAGE_5_TEXT_ONLY_ERRORS = new Set([
  PAGE_5_CHAMPION_CONNECTION_ERROR,
  PAGE_5_CLIFFHANGER_ERROR,
  "Page 5 is missing text.",
  "Page 5 contains immersion-breaking meta text.",
]);

export function isPage5TextOnlyFailure(errors: string[]) {
  return errors.length > 0 && errors.every((error) => PAGE_5_TEXT_ONLY_ERRORS.has(error));
}

export function getConnectedChampionName(
  book: Partial<LoreBook>,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  return (
    book.championConnection?.championName?.trim() ||
    approvedSynopsis?.championConnection.championName?.trim() ||
    ""
  );
}

export function pageReferencesChampionConnection(
  pageText: string,
  championConnection?: Partial<ChampionConnection>,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  const normalizedText = pageText.toLowerCase().trim();
  if (!normalizedText) {
    return false;
  }

  const championName =
    championConnection?.championName?.trim() || approvedSynopsis?.championConnection.championName?.trim() || "";

  if (championName && normalizedText.includes(championName.toLowerCase())) {
    return true;
  }

  if (championName) {
    const nameParts = championName.split(/\s+/).filter((part) => part.length >= 3);
    if (nameParts.some((part) => normalizedText.includes(part.toLowerCase()))) {
      return true;
    }
  }

  const connectionType = championConnection?.connectionType?.trim();
  if (connectionType && connectionType.length >= 10 && normalizedText.includes(connectionType.toLowerCase())) {
    return true;
  }

  const connectionSummary =
    championConnection?.connectionSummary?.trim() ||
    approvedSynopsis?.championConnection.connectionSummary?.trim() ||
    "";

  if (connectionSummary) {
    const tokens = connectionSummary
      .toLowerCase()
      .split(/[^a-z0-9'-]+/i)
      .filter((token) => token.length >= 5 && !CHAMPION_REFERENCE_STOP_WORDS.has(token));

    const matchingTokens = tokens.filter((token) => normalizedText.includes(token));
    if (matchingTokens.length >= 2 || (matchingTokens.length >= 1 && tokens.length === 1)) {
      return true;
    }
  }

  return false;
}

export function snapshotBookPages(book: Partial<LoreBook>) {
  return book.pages ? book.pages.map((page) => ({ ...page })) : [];
}

export function mergeRepairedPage5(originalBook: Partial<LoreBook>, candidateBook: Partial<LoreBook>) {
  const originalPages = snapshotBookPages(originalBook);
  if (originalPages.length !== 8) {
    return originalBook;
  }

  const candidatePageFive = candidateBook.pages?.[4];
  if (!candidatePageFive?.text?.trim()) {
    return { ...originalBook, pages: originalPages };
  }

  const pages = originalPages.map((page, index) =>
    index === 4
      ? {
          ...page,
          ...candidatePageFive,
          pageNumber: 5,
          title: candidatePageFive.title?.trim() || page.title,
          text: candidatePageFive.text.trim(),
          imagePrompt: candidatePageFive.imagePrompt?.trim() || page.imagePrompt,
        }
      : page,
  );

  return { ...originalBook, pages };
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimToMaxWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  return `${words.slice(0, maxWords).join(" ").trim()}…`;
}

export function applyPage5ChampionFallbackPatch(
  pageFive: BookPage,
  championName: string,
  protagonistName: string,
  maxWords = 95,
) {
  const patchSentence = `In that moment, the shadow of ${championName} crossed ${protagonistName}'s path, and the legend no longer belonged to one life alone.`;
  const combinedText = `${pageFive.text.trim()} ${patchSentence}`.trim();
  return {
    ...pageFive,
    pageNumber: 5,
    text: trimToMaxWords(combinedText, maxWords),
  };
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

export async function repairPage5ChampionConnection(
  book: Partial<LoreBook>,
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  const model = getBookTextModel();
  const championName = getConnectedChampionName(book, approvedSynopsis) || "the connected champion";
  const connectionSummary =
    book.championConnection?.connectionSummary?.trim() ||
    approvedSynopsis?.championConnection.connectionSummary?.trim() ||
    "";
  const pageFive = book.pages?.[4];

  const response = await openai.responses.create({
    model,
    instructions:
      "You rewrite only page 5 of an in-world Runeterra biography. Return only one valid JSON object. No markdown fences. No prose outside JSON.",
    input: `The generated book is almost valid, but page 5 does not clearly reference the chosen champion connection.

Rewrite only page 5.

Rules:
- Keep the same character: ${input.name}
- Keep the same region: ${book.region || input.runeterraRegion}
- Keep the same story continuity from pages 1-4
- Keep page 5 as the turning point and end with a direct cliffhanger
- Naturally reference ${championName} or the champion connection described below
- Do not copy the connection summary verbatim unless it fits naturally
- Keep the page length between 55 and 95 words
- Do not mention page numbers, payment, unlock, reader, AI, prompt, JSON, or story structure
- Return only the corrected page 5 JSON object

Current page 5:
${JSON.stringify(pageFive, null, 2)}

Champion connection:
${JSON.stringify(book.championConnection, null, 2)}

Approved synopsis connection summary:
${connectionSummary}

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
    throw new Error("Page 5 champion connection repair returned an empty response.");
  }

  return parseRepairedPage(rawText);
}

export async function attemptPage5ChampionConnectionRepair(
  book: Partial<LoreBook>,
  input: BookFormInput,
  approvedSynopsis: ApprovedSynopsis | null | undefined,
  attempt: number,
) {
  const originalSnapshot = snapshotBookPages(book);
  const championName = getConnectedChampionName(book, approvedSynopsis);

  console.log("[TEXT_REPAIR_PAGE_5_ONLY_START]", {
    attempt,
    connectedChampionName: championName,
  });

  const workingBook: Partial<LoreBook> = {
    ...book,
    pages: snapshotBookPages(book),
  };

  try {
    const repairedPage = await repairPage5ChampionConnection(workingBook, input, approvedSynopsis);
    const mergedBook = mergeRepairedPage5({ ...book, pages: originalSnapshot }, {
      ...workingBook,
      pages: workingBook.pages!.map((page, index) => (index === 4 ? repairedPage : page)),
    });

    const pageFive = mergedBook.pages?.[4];
    const mentionsChampion = pageFive?.text
      ? pageReferencesChampionConnection(pageFive.text, mergedBook.championConnection, approvedSynopsis)
      : false;

    console.log("[TEXT_REPAIR_PAGE_5_ONLY_DONE]", {
      attempt,
      page5WordCount: pageFive?.text ? countWords(pageFive.text) : 0,
      mentionsChampion,
    });

    return mergedBook;
  } catch (error) {
    console.error("[TEXT_REPAIR_PAGE_5_ONLY_ERROR]", {
      attempt,
      error: error instanceof Error ? error.message : error,
    });
    return { ...book, pages: originalSnapshot };
  }
}

export async function repairPage5Cliffhanger(book: Partial<LoreBook>, input: BookFormInput) {
  const model = getBookTextModel();
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
  const model = getBookTextModel();
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
  const originalSnapshot = snapshotBookPages(book);
  const workingBook: Partial<LoreBook> = {
    ...book,
    pages: snapshotBookPages(book),
  };

  logPage5CliffhangerFailure(workingBook);

  try {
    const repairedPage = await repairPage5Cliffhanger(workingBook, input);
    workingBook.pages![4] = repairedPage;

    const repairedErrors = validatePage5Cliffhanger(workingBook.pages![4]);
    if (!repairedErrors.includes(PAGE_5_CLIFFHANGER_ERROR)) {
      return mergeRepairedPage5({ ...book, pages: originalSnapshot }, workingBook);
    }
  } catch (error) {
    console.error("[PAGE_5_CLIFFHANGER_REPAIR_ERROR]", error);
  }

  const currentPageFive = workingBook.pages?.[4];
  if (!currentPageFive?.text) {
    return { ...book, pages: originalSnapshot };
  }

  try {
    const rewrittenLastSentence = await repairPage5LastSentence(currentPageFive.text);
    workingBook.pages![4] = {
      ...currentPageFive,
      text: replaceLastSentence(currentPageFive.text, rewrittenLastSentence),
    };

    const finalErrors = validatePage5Cliffhanger(workingBook.pages![4]);
    if (!finalErrors.includes(PAGE_5_CLIFFHANGER_ERROR)) {
      return mergeRepairedPage5({ ...book, pages: originalSnapshot }, workingBook);
    }
  } catch (error) {
    console.error("[PAGE_5_CLIFFHANGER_REPAIR_ERROR]", error);
  }

  return { ...book, pages: originalSnapshot };
}
