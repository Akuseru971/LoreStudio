import "server-only";

import { openai } from "@/lib/server/openai";
import { BOOK_TEXT_MODEL } from "@/lib/server/ai-config";
import { TEXT_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import { validatePage5Cliffhanger } from "@/lib/page5Cliffhanger";
import { buildLorePhase2Prompt } from "@/lib/prompts";
import type { ApprovedSynopsis, BookFormInput, BookPage, LoreBook, StoredBook } from "@/lib/types";

export const PHASE_2_PAGE_NUMBERS = [3, 4, 5, 6, 7, 8] as const;

const IMMERSION_BANNED_PATTERN =
  /\b(page\s*\d+|previous page|next page|this page|chapter|unlock|payment|reader|generated|prompt|ai)\b/i;

const IMMERSION_META_PATTERNS = [
  /\bin this chapter\b/i,
  /\bthis story\b/i,
  /\bthe reader\b/i,
  /\bthe protagonist\b/i,
  /\bas an ai\b/i,
  /\bhere is\b/i,
  /\bwriting instructions?\b/i,
  /\bprompt commentary\b/i,
  /\bpage-generation commentary\b/i,
];

export class Phase2RetryableError extends Error {
  invalidPages: number[];

  constructor(invalidPages: number[], reason: string) {
    super(reason);
    this.name = "Phase2RetryableError";
    this.invalidPages = invalidPages;
  }
}

function containsImmersionBreakingMeta(text: string) {
  if (IMMERSION_BANNED_PATTERN.test(text)) {
    return true;
  }

  return IMMERSION_META_PATTERNS.some((pattern) => pattern.test(text));
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

export function isPlaceholderPhase2PageText(text?: string | null) {
  const trimmed = text?.trim();
  return !trimmed || trimmed.includes("remains veiled");
}

export function isPhase2TextIncomplete(storedBook: StoredBook) {
  const book = storedBook.free_book;
  if (!book) {
    return false;
  }

  if (storedBook.status !== "free" && storedBook.status !== "checkout_started") {
    return false;
  }

  const pages = book.pages || [];
  if (pages.length < 8) {
    return true;
  }

  for (const pageNumber of PHASE_2_PAGE_NUMBERS) {
    const page = pages.find((item) => (item.pageNumber ?? 0) === pageNumber);
    if (!page || isPlaceholderPhase2PageText(page.text)) {
      return true;
    }
  }

  return false;
}

export function buildPhase2PageMap(pages: BookPage[]) {
  const pageMap = new Map<number, BookPage>();

  pages.forEach((page, index) => {
    const explicitNumber = page.pageNumber;
    if (typeof explicitNumber === "number" && explicitNumber >= 3 && explicitNumber <= 8) {
      if (!pageMap.has(explicitNumber)) {
        pageMap.set(explicitNumber, { ...page, pageNumber: explicitNumber });
      }
      return;
    }

    if (pages.length === 6) {
      const inferredNumber = index + 3;
      if (!pageMap.has(inferredNumber)) {
        pageMap.set(inferredNumber, { ...page, pageNumber: inferredNumber });
      }
    }
  });

  return pageMap;
}

export function buildOrderedPhase2Pages(pages: BookPage[]) {
  const pageMap = buildPhase2PageMap(pages);
  return PHASE_2_PAGE_NUMBERS.map((pageNumber) => {
    const page = pageMap.get(pageNumber);
    return {
      pageNumber,
      chapter: page?.chapter || `Chapter ${pageNumber}`,
      title: page?.title?.trim() || "",
      text: page?.text?.trim() || "",
      imagePrompt: page?.imagePrompt?.trim() || "",
      visualDirection: page?.visualDirection,
    };
  });
}

export function validatePhase2Page(page: BookPage | undefined, pageNumber: number, championName?: string) {
  const errors: string[] = [];

  if (!page) {
    errors.push(`Page ${pageNumber} is missing.`);
    return errors;
  }

  const actualNumber = page.pageNumber ?? pageNumber;
  if (actualNumber !== pageNumber) {
    errors.push(`Page ${pageNumber} has wrong pageNumber ${actualNumber}.`);
  }

  if (!page.title?.trim() || !page.text?.trim() || !page.imagePrompt?.trim()) {
    errors.push(`Page ${pageNumber} is missing title, text, or imagePrompt.`);
  }

  if (containsImmersionBreakingMeta(page.text || "") || containsImmersionBreakingMeta(page.title || "")) {
    errors.push(`Page ${pageNumber} contains immersion-breaking meta text.`);
  }

  if (pageNumber === 5 && championName && !page.text?.toLowerCase().includes(championName.toLowerCase())) {
    errors.push("Page 5 must reference the chosen champion connection.");
  }

  if (pageNumber === 5) {
    errors.push(...validatePage5Cliffhanger(page));
  }

  return errors;
}

export function collectInvalidPhase2PageNumbers(pages: BookPage[], championName?: string) {
  const pageMap = buildPhase2PageMap(pages);
  const invalid = new Set<number>();

  const seenNumbers = new Set<number>();
  for (const page of pages) {
    const pageNumber = page.pageNumber;
    if (typeof pageNumber === "number" && pageNumber >= 3 && pageNumber <= 8) {
      if (seenNumbers.has(pageNumber)) {
        invalid.add(pageNumber);
      }
      seenNumbers.add(pageNumber);
    }
  }

  for (const pageNumber of PHASE_2_PAGE_NUMBERS) {
    const page = pageMap.get(pageNumber);
    const pageErrors = validatePhase2Page(page, pageNumber, championName);
    if (pageErrors.length > 0) {
      invalid.add(pageNumber);
    }
  }

  return [...invalid].sort((a, b) => a - b);
}

export function validateLorePhase2Pages(pages: BookPage[], championName?: string) {
  const errors: string[] = [];

  if (pages.length !== 6) {
    errors.push("Phase 2 must contain exactly 6 pages (3 through 8).");
  }

  const orderedPages = buildOrderedPhase2Pages(pages);
  for (const page of orderedPages) {
    errors.push(...validatePhase2Page(page, page.pageNumber, championName));
  }

  return errors;
}

function parseRepairedPhase2Pages(rawText: string, expectedPageNumbers: number[]) {
  const parsed = JSON.parse(extractJson(rawText)) as { pages?: BookPage[] };
  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const pageMap = buildPhase2PageMap(pages);

  return expectedPageNumbers
    .map((pageNumber) => pageMap.get(pageNumber))
    .filter((page): page is BookPage => Boolean(page))
    .map((page) => ({
      ...page,
      pageNumber: page.pageNumber ?? 0,
      title: page.title?.trim() || "",
      text: page.text?.trim() || "",
      imagePrompt: page.imagePrompt?.trim() || "",
    }));
}

export async function requestPhase2PartialRepair({
  input,
  phase1Book,
  validPages,
  invalidPageNumbers,
  approvedSynopsis,
}: {
  input: BookFormInput;
  phase1Book: LoreBook;
  validPages: BookPage[];
  invalidPageNumbers: number[];
  approvedSynopsis?: ApprovedSynopsis | null;
}) {
  const { system, user } = buildLorePhase2Prompt(input, phase1Book, approvedSynopsis);
  const championName = phase1Book.championConnection?.championName?.trim() || "the connected champion";

  const response = await withTimeout(
    openai.responses.create({
      model: BOOK_TEXT_MODEL,
      instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
      input: `Regenerate ONLY pages ${invalidPageNumbers.join(", ")} for this biography continuation.

Preserve all valid pages exactly as provided.
Do not rewrite pages outside this list.
Keep the same protagonist, tone, region, visual identity, story engine, and continuity with pages 1 and 2.

Valid pages to preserve:
${JSON.stringify(validPages, null, 2)}

${user}

Rules for regenerated pages:
- Return only pages ${invalidPageNumbers.join(", ")}
- Each page must include pageNumber, title, text, and imagePrompt
- 55 to 95 words per page
- No meta language, no page references, no reader/AI/prompt commentary
- Page 5 must reference the chosen champion connection: ${championName}
- Page 5 must end with a strong in-world cliffhanger

Return strict JSON:
{
  "pages": [
    {
      "pageNumber": 3,
      "title": "...",
      "text": "...",
      "imagePrompt": "..."
    }
  ]
}`,
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
      max_output_tokens: 2800,
    }),
    TEXT_GENERATION_TIMEOUT_MS,
    "TEXT_PHASE_2_PARTIAL_REPAIR",
  );

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("Phase 2 partial repair returned an empty response.");
  }

  return parseRepairedPhase2Pages(rawText, invalidPageNumbers);
}

export function mergeRepairedPhase2Pages(existingPages: BookPage[], repairedPages: BookPage[]) {
  const pageMap = buildPhase2PageMap(existingPages);

  for (const page of repairedPages) {
    const pageNumber = page.pageNumber;
    if (typeof pageNumber === "number" && pageNumber >= 3 && pageNumber <= 8) {
      pageMap.set(pageNumber, { ...page, pageNumber });
    }
  }

  return buildOrderedPhase2Pages([...pageMap.values()]);
}

export async function attemptPhase2PartialRepair({
  bookId,
  input,
  phase1Book,
  pages,
  approvedSynopsis,
}: {
  bookId?: string;
  input: BookFormInput;
  phase1Book: LoreBook;
  pages: BookPage[];
  approvedSynopsis?: ApprovedSynopsis | null;
}) {
  const championName = phase1Book.championConnection?.championName;
  let workingPages = buildOrderedPhase2Pages(pages);
  let invalidPages = collectInvalidPhase2PageNumbers(workingPages, championName);

  if (invalidPages.length === 0) {
    return workingPages;
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const validPages = workingPages.filter(
      (page) =>
        !invalidPages.includes(page.pageNumber) &&
        validatePhase2Page(page, page.pageNumber, championName).length === 0,
    );
    console.log("[TEXT_PHASE_2_PARTIAL_REPAIR_START]", {
      bookId: bookId ?? null,
      invalidPages,
      attempt,
    });

    try {
      const repairedPages = await requestPhase2PartialRepair({
        input,
        phase1Book,
        validPages,
        invalidPageNumbers: invalidPages,
        approvedSynopsis,
      });

      workingPages = mergeRepairedPhase2Pages(workingPages, repairedPages);
      invalidPages = collectInvalidPhase2PageNumbers(workingPages, championName);

      if (invalidPages.length === 0) {
        console.log("[TEXT_PHASE_2_PARTIAL_REPAIR_DONE]", {
          bookId: bookId ?? null,
          repairedPages: repairedPages.map((page) => page.pageNumber),
          finalPageCount: workingPages.length,
        });
        return workingPages;
      }
    } catch (error) {
      console.error("[TEXT_PHASE_2_PARTIAL_REPAIR_ERROR]", {
        bookId: bookId ?? null,
        invalidPages,
        attempt,
        error,
      });
    }
  }

  throw new Phase2RetryableError(
    invalidPages,
    `Phase 2 partial repair failed for pages ${invalidPages.join(", ")}.`,
  );
}
