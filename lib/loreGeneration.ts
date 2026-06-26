import "server-only";

import { buildFallbackLoreBook } from "@/lib/fallback-lore";
import { openai } from "@/lib/server/openai";
import { BOOK_TEXT_MODEL } from "@/lib/server/ai-config";
import { MAX_TEXT_REPAIR_ATTEMPTS, TEXT_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import {
  PAGE_5_CHAMPION_CONNECTION_ERROR,
  applyPage5ChampionFallbackPatch,
  attemptPage5ChampionConnectionRepair,
  attemptPage5CliffhangerRepair,
  getConnectedChampionName,
  isPage5TextOnlyFailure,
  mergeRepairedPage5,
  pageReferencesChampionConnection,
  snapshotBookPages,
  validatePage5Cliffhanger,
} from "@/lib/page5Cliffhanger";
import { buildLorePrompt } from "@/lib/prompts";
import { validateGeneratedStory } from "@/lib/story-engine";
import type { ApprovedSynopsis, BookFormInput, LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

const IMMERSION_BANNED_PATTERN =
  /\b(page\s*\d+|previous page|next page|this page|chapter|unlock|payment|reader|generated|prompt|ai)\b/i;

export type GenerateLoreResult = {
  book: LoreBook;
  fallback: boolean;
};

type FinalizeLoreBookOptions = {
  repairAttempt?: number;
  allowChampionFallback?: boolean;
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

function getInvalidPages(errors: string[]) {
  const matches = errors
    .map((error) => error.match(/Page (\d+)/i)?.[1])
    .filter((value): value is string => Boolean(value));
  return [...new Set(matches.map((value) => Number(value)))];
}

function logTextValidationFailed(
  errors: string[],
  book: Partial<LoreBook>,
  approvedSynopsis?: ApprovedSynopsis | null,
) {
  const pageFive = book.pages?.[4];
  const connectedChampionName = getConnectedChampionName(book, approvedSynopsis);

  console.log("[TEXT_VALIDATION_FAILED]", {
    reason: errors.join(" "),
    invalidPages: getInvalidPages(errors),
    pageCount: book.pages?.length ?? 0,
    hasPage5Text: Boolean(pageFive?.text?.trim()),
    page5MentionsChampion: pageFive?.text
      ? pageReferencesChampionConnection(pageFive.text, book.championConnection, approvedSynopsis)
      : false,
    connectedChampionName,
  });
}

function validateLoreStructure(book: Partial<LoreBook>, approvedSynopsis?: ApprovedSynopsis | null) {
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
  const connectedChampionName = getConnectedChampionName(book, approvedSynopsis);
  if (pageFive && connectedChampionName) {
    if (
      !pageFive.text?.trim() ||
      !pageReferencesChampionConnection(pageFive.text, book.championConnection, approvedSynopsis)
    ) {
      errors.push(PAGE_5_CHAMPION_CONNECTION_ERROR);
    }
  }

  errors.push(...validatePage5Cliffhanger(pageFive));

  return errors;
}

function cloneBookWithPages(book: Partial<LoreBook>) {
  return {
    ...book,
    pages: snapshotBookPages(book),
  };
}

async function applyPage5Repairs(
  parsed: Partial<LoreBook>,
  input: BookFormInput,
  approvedSynopsis: ApprovedSynopsis | null | undefined,
  options: FinalizeLoreBookOptions,
) {
  const originalSnapshot = snapshotBookPages(parsed);
  let workingBook: Partial<LoreBook> = cloneBookWithPages(parsed);
  let structureErrors = validateLoreStructure(workingBook, approvedSynopsis);
  let repaired = false;

  if (structureErrors.length > 0) {
    logTextValidationFailed(structureErrors, workingBook, approvedSynopsis);
  }

  if (!isPage5TextOnlyFailure(structureErrors)) {
    return { workingBook, structureErrors, repaired };
  }

  if (structureErrors.includes(PAGE_5_CHAMPION_CONNECTION_ERROR) && options.repairAttempt) {
    const repairedBook = await attemptPage5ChampionConnectionRepair(
      workingBook,
      input,
      approvedSynopsis,
      options.repairAttempt,
    );
    workingBook = mergeRepairedPage5({ ...parsed, pages: originalSnapshot }, repairedBook);
    structureErrors = validateLoreStructure(workingBook, approvedSynopsis);
    repaired = true;
  }

  const cliffhangerErrors = validatePage5Cliffhanger(workingBook.pages?.[4]);
  if (cliffhangerErrors.length > 0) {
    const repairedBook = await attemptPage5CliffhangerRepair(workingBook, input);
    workingBook = mergeRepairedPage5({ ...parsed, pages: originalSnapshot }, repairedBook);
    structureErrors = validateLoreStructure(workingBook, approvedSynopsis);
    repaired = true;
  }

  if (
    options.allowChampionFallback &&
    structureErrors.length === 1 &&
    structureErrors[0] === PAGE_5_CHAMPION_CONNECTION_ERROR
  ) {
    const championName = getConnectedChampionName(workingBook, approvedSynopsis);
    const pageFive = workingBook.pages?.[4];
    if (championName && pageFive?.text?.trim()) {
      workingBook = mergeRepairedPage5(
        { ...parsed, pages: originalSnapshot },
        {
          ...workingBook,
          pages: workingBook.pages!.map((page, index) =>
            index === 4 ? applyPage5ChampionFallbackPatch(pageFive, championName, input.name) : page,
          ),
        },
      );
      console.log("[TEXT_REPAIR_FALLBACK_PATCH_USED]", {
        connectedChampionName: championName,
      });
      structureErrors = validateLoreStructure(workingBook, approvedSynopsis);
      repaired = true;
    }
  }

  return { workingBook, structureErrors, repaired };
}

async function finalizeLoreBook(
  parsed: Partial<LoreBook>,
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
  options: FinalizeLoreBookOptions = {},
) {
  const { workingBook, structureErrors, repaired } = await applyPage5Repairs(
    parsed,
    input,
    approvedSynopsis,
    options,
  );

  if (structureErrors.length > 0) {
    throw new Error(`Generated lore failed validation: ${structureErrors.join(" ")}`);
  }

  if (repaired) {
    console.log("[TEXT_VALIDATION_PASSED_AFTER_REPAIR]");
  }

  const normalized = normalizeLoreBook(workingBook);
  const issues = validateGeneratedStory(normalized);
  if (issues.length > 0) {
    console.warn("[LORE_GENERATION_VALIDATION_WARNINGS]", issues);
  }

  return normalized;
}

function parseLoreBookJson(rawText: string) {
  return JSON.parse(extractJson(rawText)) as Partial<LoreBook>;
}

async function parseLoreBook(
  rawText: string,
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
  options: FinalizeLoreBookOptions = {},
) {
  let parsed: Partial<LoreBook>;

  try {
    parsed = parseLoreBookJson(rawText);
  } catch (error) {
    console.error("[LORE_JSON_PARSE_ERROR]", {
      rawPreview: rawText.slice(0, 1000),
      message: error instanceof Error ? error.message : "Invalid JSON",
    });
    throw error;
  }

  return finalizeLoreBook(parsed, input, approvedSynopsis, options);
}

async function requestRawLoreText(input: BookFormInput, approvedSynopsis?: ApprovedSynopsis | null) {
  const { system, user } = buildLorePrompt(input, approvedSynopsis);
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
      max_output_tokens: 4500,
    }),
    TEXT_GENERATION_TIMEOUT_MS,
    "TEXT_GENERATION",
  );

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("The lore model returned an empty response.");
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

function runTimedValidation<T>(label: string, task: () => Promise<T>) {
  const startedAt = Date.now();
  console.log(`[${label}_START]`, { startedAt });
  return task().finally(() => {
    console.log(`[${label}_DONE]`, { durationMs: Date.now() - startedAt });
  });
}

export async function generateLoreBook(
  input: BookFormInput,
  approvedSynopsis?: ApprovedSynopsis | null,
): Promise<GenerateLoreResult> {
  requireOpenAiKey();
  console.log("[BOOK_TEXT_MODEL_USED]", BOOK_TEXT_MODEL);
  console.log("[TEXT_GENERATION_START]", Date.now());

  if (!approvedSynopsis) {
    console.warn("[SYNOPSIS_MISSING] Full generation started without approved synopsis");
  }

  let lastError: unknown;
  let lastRawText = "";
  let parsedBook: Partial<LoreBook> | null = null;

  try {
    lastRawText = await requestRawLoreText(input, approvedSynopsis);
    console.log("[TEXT_GENERATION_DONE]", Date.now());
    const book = await runTimedValidation("TEXT_VALIDATION", () =>
      parseLoreBook(lastRawText, input, approvedSynopsis),
    );
    return { book, fallback: false };
  } catch (error) {
    lastError = error;
    logLoreGenerationError(error);
    try {
      parsedBook = parseLoreBookJson(lastRawText);
    } catch {
      parsedBook = null;
    }
  }

  if (parsedBook?.pages?.length === 8) {
    for (let attempt = 1; attempt <= MAX_TEXT_REPAIR_ATTEMPTS; attempt += 1) {
      console.log("[TEXT_REPAIR_ATTEMPT]", attempt, {
        mode: "page_5_only",
        hasRawText: Boolean(lastRawText),
      });

      try {
        const book = await runTimedValidation(`TEXT_REPAIR_${attempt}`, () =>
          finalizeLoreBook(parsedBook!, input, approvedSynopsis, {
            repairAttempt: attempt,
            allowChampionFallback: attempt === MAX_TEXT_REPAIR_ATTEMPTS,
          }),
        );
        return { book, fallback: false };
      } catch (repairError) {
        lastError = repairError;
        logLoreGenerationError(repairError);
      }
    }
  } else if (lastRawText) {
    for (let attempt = 1; attempt <= MAX_TEXT_REPAIR_ATTEMPTS; attempt += 1) {
      console.log("[TEXT_REPAIR_ATTEMPT]", attempt, {
        mode: "full_json",
        hasRawText: Boolean(lastRawText),
      });

      try {
        const repairedText = await repairLoreJson(lastRawText, input);
        const book = await runTimedValidation(`TEXT_REPAIR_${attempt}`, () =>
          parseLoreBook(repairedText, input, approvedSynopsis, {
            repairAttempt: attempt,
            allowChampionFallback: attempt === MAX_TEXT_REPAIR_ATTEMPTS,
          }),
        );
        return { book, fallback: false };
      } catch (repairError) {
        lastError = repairError;
        logLoreGenerationError(repairError);
        try {
          parsedBook = parseLoreBookJson(lastRawText);
        } catch {
          parsedBook = null;
        }
      }
    }
  }

  if (isFallbackLoreEnabled()) {
    console.error("[LORE_GENERATION_FALLBACK]", "All lore generation attempts failed. Returning fallback lore book.", lastError);
    return { book: buildFallbackLoreBook(input), fallback: true };
  }

  if (isDevOrPreview()) {
    throw lastError instanceof Error ? lastError : new Error("Lore generation failed.");
  }

  throw lastError instanceof Error ? lastError : new Error("Lore generation failed.");
}
