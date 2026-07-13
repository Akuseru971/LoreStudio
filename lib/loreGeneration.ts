import "server-only";

import { buildFallbackLoreBook } from "@/lib/fallback-lore";
import { updateFreeBook, updateGenerationProgress } from "@/lib/bookStore";
import {
  attemptPhase2PartialRepair,
  buildOrderedPhase2Pages,
  isPhase2TextIncomplete,
  Phase2RetryableError,
  validateLorePhase2Pages,
} from "@/lib/phase2TextRepair";
import { openai } from "@/lib/server/openai";
import { BOOK_TEXT_MODEL } from "@/lib/server/ai-config";
import { MAX_TEXT_REPAIR_ATTEMPTS, TEXT_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import {
  attemptPage5CliffhangerRepair,
  isCliffhangerOnlyFailure,
  validatePage5Cliffhanger,
} from "@/lib/page5Cliffhanger";
import { buildLorePhase1Prompt, buildLorePhase2Prompt, buildLorePrompt } from "@/lib/prompts";
import { validateGeneratedStory } from "@/lib/story-engine";
import type { ApprovedSynopsis, BookFormInput, BookPage, LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

const IMMERSION_BANNED_PATTERN =
  /\b(page\s*\d+|previous page|next page|this page|chapter|unlock|payment|reader|generated|prompt|ai)\b/i;

export type GenerateLoreResult = {
  book: LoreBook;
  fallback: boolean;
};

export function isFallbackLoreEnabled() {
  return process.env.ENABLE_FALLBACK_LORE === "true";
}

export function isDevOrPreview() {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
}

export function getLoreModel() {
  return BOOK_TEXT_MODEL;
}

function requireOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
}

export function logLoreGenerationError(error: unknown) {
  const typed = error as {
    message?: string;
    name?: string;
    status?: number;
    code?: string;
    type?: string;
    response?: { data?: unknown };
  };

  console.error("[LORE_GENERATION_ERROR]", {
    message: typed?.message,
    name: typed?.name,
    status: typed?.status,
    code: typed?.code,
    type: typed?.type,
    response: typed?.response?.data,
  });
}

function extractJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!trimmed) {
    throw new Error("The lore model returned an empty response.");
  }

  const start = trimmed.indexOf("{");
  if (start === -1) {
    throw new Error("The lore model did not return JSON.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  const end = trimmed.lastIndexOf("}");
  if (end <= start) {
    throw new Error("The lore model did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
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

function validateLoreStructure(book: Partial<LoreBook>) {
  const errors: string[] = [];

  if (!book.title?.trim()) {
    errors.push("Missing title.");
  }

  if (!book.pages || book.pages.length !== 8) {
    errors.push("Book must contain exactly 8 pages.");
  }

  book.pages?.forEach((page, index) => {
    const pageNumber = page.pageNumber ?? index + 1;
    if (!page.title?.trim() || !page.text?.trim() || !page.imagePrompt?.trim()) {
      errors.push(`Page ${pageNumber} is missing title, text, or imagePrompt.`);
    }

    if (IMMERSION_BANNED_PATTERN.test(page.text || "") || IMMERSION_BANNED_PATTERN.test(page.title || "")) {
      errors.push(`Page ${pageNumber} contains immersion-breaking meta text.`);
    }
  });

  const pageFive = book.pages?.[4];
  const championName = book.championConnection?.championName?.trim();
  if (pageFive && championName && !pageFive.text?.toLowerCase().includes(championName.toLowerCase())) {
    errors.push("Page 5 must reference the chosen champion connection.");
  }

  errors.push(...validatePage5Cliffhanger(pageFive));

  return errors;
}

function validateLorePhase1Structure(book: Partial<LoreBook>) {
  const errors: string[] = [];

  if (!book.title?.trim()) {
    errors.push("Missing title.");
  }

  if (!book.visualBible || !book.visualBible.appearance?.trim()) {
    errors.push("Missing visualBible.");
  }

  if (!book.pages || book.pages.length < 2) {
    errors.push("Phase 1 must contain pages 1 and 2.");
  }

  for (let index = 0; index < 2; index += 1) {
    const page = book.pages?.[index];
    const pageNumber = page?.pageNumber ?? index + 1;
    if (!page?.title?.trim() || !page?.text?.trim() || !page?.imagePrompt?.trim()) {
      errors.push(`Page ${pageNumber} is missing title, text, or imagePrompt.`);
    }

    if (IMMERSION_BANNED_PATTERN.test(page?.text || "") || IMMERSION_BANNED_PATTERN.test(page?.title || "")) {
      errors.push(`Page ${pageNumber} contains immersion-breaking meta text.`);
    }
  }

  return errors;
}

export function mergeLoreBookPhases(phase1Book: LoreBook, phase2Pages: BookPage[]): Partial<LoreBook> {
  const normalizedPhase2Pages = phase2Pages.map((page, index) => ({
    ...page,
    pageNumber: page.pageNumber ?? index + 3,
  }));

  return {
    title: phase1Book.title,
    subtitle: phase1Book.subtitle,
    region: phase1Book.region,
    genre: phase1Book.genre,
    storyEngine: phase1Book.storyEngine,
    championConnection: phase1Book.championConnection,
    visualBible: phase1Book.visualBible,
    pages: [...phase1Book.pages.slice(0, 2), ...normalizedPhase2Pages],
  };
}

async function finalizeLoreBookPhase1(parsed: Partial<LoreBook>, input: BookFormInput) {
  const structureErrors = validateLorePhase1Structure(parsed);
  if (structureErrors.length > 0) {
    throw new Error(`Generated lore phase 1 failed validation: ${structureErrors.join(" ")}`);
  }

  const partial = {
    ...parsed,
    pages: parsed.pages?.slice(0, 2),
  };

  return normalizeLoreBook(partial);
}

async function finalizeMergedLoreBook(phase1Book: LoreBook, phase2Pages: BookPage[], input: BookFormInput) {
  let workingBook: Partial<LoreBook> = mergeLoreBookPhases(phase1Book, phase2Pages);
  let structureErrors = validateLoreStructure(workingBook);

  if (isCliffhangerOnlyFailure(structureErrors)) {
    workingBook = await attemptPage5CliffhangerRepair(workingBook, input);
    structureErrors = validateLoreStructure(workingBook);
  }

  if (structureErrors.length > 0) {
    throw new Error(`Generated lore failed validation: ${structureErrors.join(" ")}`);
  }

  const normalized = normalizeLoreBook(workingBook);
  const issues = validateGeneratedStory(normalized);
  if (issues.length > 0) {
    console.warn("[LORE_GENERATION_VALIDATION_WARNINGS]", issues);
  }

  return normalized;
}

async function requestRawLoreTextPhase1(input: BookFormInput, approvedSynopsis?: ApprovedSynopsis | null) {
  const { system, user } = buildLorePhase1Prompt(input, approvedSynopsis);
  const model = getLoreModel();

  const response = await withTimeout(
    openai.responses.create({
      model,
      instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
      input: `${user}\n\nReturn only one valid JSON object. No markdown fences. No apology. No explanatory sentence.`,
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
      max_output_tokens: 2800,
    }),
    TEXT_GENERATION_TIMEOUT_MS,
    "TEXT_GENERATION_PHASE_1",
  );

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("The lore phase 1 model returned an empty response.");
  }

  return rawText;
}

async function requestRawLoreTextPhase2(
  input: BookFormInput,
  phase1Book: LoreBook,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  const { system, user } = buildLorePhase2Prompt(input, phase1Book, approvedSynopsis);
  const model = getLoreModel();

  const response = await withTimeout(
    openai.responses.create({
      model,
      instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
      input: `${user}\n\nReturn only one valid JSON object. No markdown fences. No apology. No explanatory sentence.`,
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
      max_output_tokens: 3800,
    }),
    TEXT_GENERATION_TIMEOUT_MS,
    "TEXT_GENERATION_PHASE_2",
  );

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("The lore phase 2 model returned an empty response.");
  }

  return rawText;
}

async function repairLoreJson(invalidOutput: string, input: BookFormInput) {
  const model = getLoreModel();
  const { system } = buildLorePrompt(input);

  const response = await withTimeout(
    openai.responses.create({
      model,
      instructions: `${system}\nThe previous output was invalid. Return only valid JSON matching this schema. Do not add markdown, comments, or explanations.`,
      input: `Repair this invalid biography JSON output:\n\n${invalidOutput.slice(0, 4000)}`,
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
      max_output_tokens: 4500,
    }),
    TEXT_GENERATION_TIMEOUT_MS,
    "TEXT_REPAIR",
  );

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("Lore JSON repair returned an empty response.");
  }

  return rawText;
}

async function parseLoreBookPhase1(rawText: string, input: BookFormInput) {
  let parsed: Partial<LoreBook>;

  try {
    parsed = JSON.parse(extractJson(rawText)) as Partial<LoreBook>;
  } catch (error) {
    console.error("[LORE_JSON_PARSE_ERROR]", {
      phase: 1,
      rawPreview: rawText.slice(0, 1000),
      message: error instanceof Error ? error.message : "Invalid JSON",
    });
    throw error;
  }

  return finalizeLoreBookPhase1(parsed, input);
}

async function parseLoreBookPhase2(
  rawText: string,
  phase1Book: LoreBook,
  input: BookFormInput,
  options: { bookId?: string; approvedSynopsis?: ApprovedSynopsis | null } = {},
) {
  let parsed: { pages?: BookPage[] };

  try {
    parsed = JSON.parse(extractJson(rawText)) as { pages?: BookPage[] };
  } catch (error) {
    console.error("[LORE_JSON_PARSE_ERROR]", {
      phase: 2,
      rawPreview: rawText.slice(0, 1000),
      message: error instanceof Error ? error.message : "Invalid JSON",
    });
    throw error;
  }

  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const championName = phase1Book.championConnection?.championName;
  const structureErrors = validateLorePhase2Pages(pages, championName);

  let orderedPages = buildOrderedPhase2Pages(pages);
  if (structureErrors.length > 0) {
    orderedPages = await attemptPhase2PartialRepair({
      bookId: options.bookId,
      input,
      phase1Book,
      pages,
      approvedSynopsis: options.approvedSynopsis,
    });
  }

  return finalizeMergedLoreBook(phase1Book, orderedPages, input);
}

export function extractPhase1LoreBook(book: LoreBook): LoreBook {
  return {
    ...book,
    pages: book.pages.slice(0, 2),
  };
}

export { isPhase2TextIncomplete };

export async function generateLoreBookPhase1(
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
): Promise<GenerateLoreResult> {
  requireOpenAiKey();
  console.log("[BOOK_TEXT_MODEL_USED]", BOOK_TEXT_MODEL);
  console.log("[TEXT_GENERATION_START]", Date.now());

  if (!approvedSynopsis) {
    console.warn("[SYNOPSIS_MISSING] Phase 1 generation started without approved synopsis");
  }

  let lastError: unknown;
  let lastRawText = "";

  try {
    lastRawText = await requestRawLoreTextPhase1(input, approvedSynopsis);
    const book = await parseLoreBookPhase1(lastRawText, input);
    console.log("[TEXT_PHASE_1_DONE_CHAPTERS_1_2]", {
      pageCount: book.pages.length,
      hasVisualBible: Boolean(book.visualBible?.appearance),
    });
    return { book, fallback: false };
  } catch (error) {
    lastError = error;
    logLoreGenerationError(error);
  }

  if (lastRawText) {
    for (let attempt = 1; attempt <= MAX_TEXT_REPAIR_ATTEMPTS; attempt += 1) {
      console.log("[TEXT_REPAIR_ATTEMPT]", attempt, {
        phase: 1,
        hasRawText: Boolean(lastRawText),
      });

      try {
        const repairedText = await repairLoreJson(lastRawText, input);
        const book = await parseLoreBookPhase1(repairedText, input);
        console.log("[TEXT_PHASE_1_DONE_CHAPTERS_1_2]", {
          pageCount: book.pages.length,
          hasVisualBible: Boolean(book.visualBible?.appearance),
          repaired: true,
        });
        return { book, fallback: false };
      } catch (repairError) {
        lastError = repairError;
        logLoreGenerationError(repairError);
      }
    }
  }

  if (isFallbackLoreEnabled()) {
    console.error("[LORE_GENERATION_FALLBACK]", "Phase 1 generation failed. Returning fallback lore book.", lastError);
    return { book: buildFallbackLoreBook(input), fallback: true };
  }

  if (isDevOrPreview()) {
    throw lastError instanceof Error ? lastError : new Error("Lore phase 1 generation failed.");
  }

  throw lastError instanceof Error ? lastError : new Error("Lore phase 1 generation failed.");
}

export async function generateLoreBookPhase2(
  phase1Book: LoreBook,
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
  options: { bookId?: string } = {},
): Promise<GenerateLoreResult> {
  requireOpenAiKey();

  let lastError: unknown;
  let lastRawText = "";

  try {
    lastRawText = await requestRawLoreTextPhase2(input, phase1Book, approvedSynopsis);
    const book = await parseLoreBookPhase2(lastRawText, phase1Book, input, {
      bookId: options.bookId,
      approvedSynopsis,
    });
    console.log("[TEXT_PHASE_2_DONE_CHAPTERS_3_8]", {
      pageCount: book.pages.length,
    });
    return { book, fallback: false };
  } catch (error) {
    lastError = error;
    logLoreGenerationError(error);
  }

  if (lastRawText) {
    for (let attempt = 1; attempt <= MAX_TEXT_REPAIR_ATTEMPTS; attempt += 1) {
      console.log("[TEXT_REPAIR_ATTEMPT]", attempt, {
        phase: 2,
        hasRawText: Boolean(lastRawText),
      });

      try {
        const repairedText = await repairLoreJson(lastRawText, input);
        const book = await parseLoreBookPhase2(repairedText, phase1Book, input, {
          bookId: options.bookId,
          approvedSynopsis,
        });
        console.log("[TEXT_PHASE_2_DONE_CHAPTERS_3_8]", {
          pageCount: book.pages.length,
          repaired: true,
        });
        return { book, fallback: false };
      } catch (repairError) {
        lastError = repairError;
        logLoreGenerationError(repairError);
      }
    }
  }

  if (lastRawText) {
    try {
      const parsed = JSON.parse(extractJson(lastRawText)) as { pages?: BookPage[] };
      const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
      const orderedPages = await attemptPhase2PartialRepair({
        bookId: options.bookId,
        input,
        phase1Book,
        pages,
        approvedSynopsis,
      });
      const book = await finalizeMergedLoreBook(phase1Book, orderedPages, input);
      console.log("[TEXT_PHASE_2_DONE_CHAPTERS_3_8]", {
        pageCount: book.pages.length,
        repaired: true,
        partial: true,
      });
      return { book, fallback: false };
    } catch (repairError) {
      lastError = repairError;
      if (repairError instanceof Phase2RetryableError) {
        console.error("[TEXT_PHASE_2_REPAIR_FAILED_RETRYABLE]", {
          bookId: options.bookId ?? null,
          invalidPages: repairError.invalidPages,
          reason: repairError.message,
        });
        throw repairError;
      }
      logLoreGenerationError(repairError);
    }
  }

  if (lastError instanceof Phase2RetryableError) {
    throw lastError;
  }

  if (isFallbackLoreEnabled()) {
    console.error("[LORE_GENERATION_FALLBACK]", "Phase 2 generation failed. Returning fallback lore book.", lastError);
    return { book: buildFallbackLoreBook(input), fallback: true };
  }

  if (isDevOrPreview()) {
    throw lastError instanceof Error ? lastError : new Error("Lore phase 2 generation failed.");
  }

  throw lastError instanceof Error ? lastError : new Error("Lore phase 2 generation failed.");
}

export async function continueBookTextPhase2(
  bookId: string,
  phase1Book: LoreBook,
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  console.log("[TEXT_PHASE_2_START_CHAPTERS_3_8]", { bookId });

  try {
    const phase2Result = await generateLoreBookPhase2(phase1Book, input, approvedSynopsis, { bookId });
    await updateFreeBook(bookId, phase2Result.book);
    await updateGenerationProgress(bookId, "generating_images", { generationError: null });
    console.log("[TEXT_PHASE_2_DONE_CHAPTERS_3_8]", {
      bookId,
      pageCount: phase2Result.book.pages.length,
      fallback: phase2Result.fallback,
    });
  } catch (error) {
    if (error instanceof Phase2RetryableError) {
      await updateGenerationProgress(bookId, "generating_images", {
        generationError: `phase_2_text_retryable:${error.invalidPages.join(",")}`,
      });
      console.error("[TEXT_PHASE_2_REPAIR_FAILED_RETRYABLE]", {
        bookId,
        invalidPages: error.invalidPages,
        reason: error.message,
      });
      return;
    }

    console.error("[TEXT_PHASE_2_ERROR]", { bookId, error });
  }
}

export async function continueBookTextPhase2FromStoredBook(storedBook: StoredBook) {
  if (!storedBook.free_book || !storedBook.form_input) {
    return;
  }

  const phase1Book = extractPhase1LoreBook(storedBook.free_book);
  await continueBookTextPhase2(
    storedBook.id,
    phase1Book,
    storedBook.form_input,
    storedBook.approved_synopsis,
  );
}

export async function generateLoreBook(
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
): Promise<GenerateLoreResult> {
  const phase1Result = await generateLoreBookPhase1(input, approvedSynopsis);
  if (phase1Result.fallback) {
    return phase1Result;
  }

  const phase2Result = await generateLoreBookPhase2(phase1Result.book, input, approvedSynopsis);
  return phase2Result;
}
