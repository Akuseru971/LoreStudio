import { buildFallbackLoreBook } from "@/lib/fallback-lore";
import { openai } from "@/lib/openai";
import {
  attemptPage5CliffhangerRepair,
  isCliffhangerOnlyFailure,
  validatePage5Cliffhanger,
} from "@/lib/page5Cliffhanger";
import { buildLorePrompt } from "@/lib/prompts";
import { validateGeneratedStory } from "@/lib/story-engine";
import type { BookFormInput, LoreBook } from "@/lib/types";
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
  return process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
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

async function finalizeLoreBook(parsed: Partial<LoreBook>, input: BookFormInput) {
  let workingBook: Partial<LoreBook> = {
    ...parsed,
    pages: parsed.pages ? [...parsed.pages] : [],
  };

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

async function parseLoreBook(rawText: string, input: BookFormInput) {
  let parsed: Partial<LoreBook>;

  try {
    parsed = JSON.parse(extractJson(rawText)) as Partial<LoreBook>;
  } catch (error) {
    console.error("[LORE_JSON_PARSE_ERROR]", {
      rawPreview: rawText.slice(0, 1000),
      message: error instanceof Error ? error.message : "Invalid JSON",
    });
    throw error;
  }

  return finalizeLoreBook(parsed, input);
}

async function requestRawLoreText(input: BookFormInput) {
  const { system, user } = buildLorePrompt(input);
  const model = getLoreModel();

  const response = await openai.responses.create({
    model,
    instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
    input: `${user}\n\nReturn only one valid JSON object. No markdown fences. No apology. No explanatory sentence.`,
    text: {
      format: { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 4500,
  });

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("The lore model returned an empty response.");
  }

  return rawText;
}

async function repairLoreJson(invalidOutput: string, input: BookFormInput) {
  const model = getLoreModel();
  const { system } = buildLorePrompt(input);

  const response = await openai.responses.create({
    model,
    instructions: `${system}\nThe previous output was invalid. Return only valid JSON matching this schema. Do not add markdown, comments, or explanations.`,
    input: `Repair this invalid biography JSON output:\n\n${invalidOutput.slice(0, 4000)}`,
    text: {
      format: { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 4500,
  });

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("Lore JSON repair returned an empty response.");
  }

  return rawText;
}

export async function generateLoreBook(input: BookFormInput): Promise<GenerateLoreResult> {
  requireOpenAiKey();
  console.log("[LORE_MODEL]", getLoreModel());

  let lastError: unknown;
  let lastRawText = "";

  try {
    lastRawText = await requestRawLoreText(input);
    return { book: await parseLoreBook(lastRawText, input), fallback: false };
  } catch (error) {
    lastError = error;
    logLoreGenerationError(error);
  }

  if (lastRawText) {
    try {
      const repairedText = await repairLoreJson(lastRawText, input);
      return { book: await parseLoreBook(repairedText, input), fallback: false };
    } catch (repairError) {
      lastError = repairError;
      logLoreGenerationError(repairError);
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
