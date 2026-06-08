import { NextResponse } from "next/server";
import { buildFallbackLoreBook } from "@/lib/fallback-lore";
import { buildLorePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { BookFormInput, LoreBook } from "@/lib/types";
import { normalizeLoreBook, validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const loreBookJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "narratorIntro", "characterBible", "pages"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    narratorIntro: { type: "string" },
    characterBible: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "legendaryTitle",
        "visualIdentity",
        "clothing",
        "faceAndBody",
        "aura",
        "symbolicObject",
        "colorPalette",
        "worldRules",
      ],
      properties: {
        name: { type: "string" },
        legendaryTitle: { type: "string" },
        visualIdentity: { type: "string" },
        clothing: { type: "string" },
        faceAndBody: { type: "string" },
        aura: { type: "string" },
        symbolicObject: { type: "string" },
        colorPalette: { type: "string" },
        worldRules: { type: "string" },
      },
    },
    pages: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageNumber", "chapter", "title", "text", "imagePrompt"],
        properties: {
          pageNumber: { type: "integer", minimum: 1, maximum: 8 },
          chapter: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          imagePrompt: { type: "string" },
        },
      },
    },
  },
};

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

function parseLoreBook(rawText: string) {
  const parsed = JSON.parse(extractJson(rawText)) as Partial<LoreBook>;
  return normalizeLoreBook(parsed);
}

async function requestLoreBook(input: BookFormInput, useSchema: boolean) {
  const { system, user } = buildLorePrompt(input);
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5";

  const response = await openai.responses.create({
    model,
    instructions: `${system}\nIf you cannot complete any detail, still return the requested JSON object with safe original fantasy content. Do not return prose outside JSON.`,
    input: `${user}\n\nReturn only one valid JSON object. No markdown fences. No apology. No explanatory sentence.`,
    text: {
      format: useSchema
        ? {
            type: "json_schema",
            name: "personalized_lore_book",
            schema: loreBookJsonSchema,
            strict: false,
          }
        : { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 6500,
  });

  return parseLoreBook(getResponseText(response));
}

async function generateLoreBook(input: BookFormInput) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OpenAI is not configured. Returning fallback lore book.");
    return buildFallbackLoreBook(input);
  }

  const attempts = [
    { label: "json_schema", useSchema: true },
    { label: "json_object", useSchema: false },
  ];

  for (const attempt of attempts) {
    try {
      return await requestLoreBook(input, attempt.useSchema);
    } catch (error) {
      console.warn(`Lore generation ${attempt.label} attempt failed.`, error);
    }
  }

  console.warn("All lore generation attempts failed. Returning fallback lore book.");
  return buildFallbackLoreBook(input);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { input, error } = validateBookInput(body);
    if (!input) {
      return NextResponse.json({ error: error || "Invalid input." }, { status: 400 });
    }

    const loreBook = await generateLoreBook(input);

    // Returning 8 base64 images in one serverless response can exceed Vercel's
    // response body limits. Images are generated lazily one page at a time via
    // /api/generate-image, while the book remains immediately usable.
    return NextResponse.json({ book: loreBook });
  } catch (error) {
    console.error("Book generation failed.", error);
    return NextResponse.json({ error: "The archives refused to open. Try again." }, { status: 500 });
  }
}
