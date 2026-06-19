import { NextResponse } from "next/server";
import { buildFallbackLoreBook } from "@/lib/fallback-lore";
import { buildLorePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { BookFormInput, LoreBook } from "@/lib/types";
import { normalizeLoreBook, validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";

const loreBookJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "subtitle",
    "mainRegion",
    "storyEngine",
    "protagonistRole",
    "coreConflict",
    "distinctiveHook",
    "narratorIntro",
    "biographyArc",
    "championConnection",
    "originalityProfile",
    "characterBible",
    "pages",
  ],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    mainRegion: { type: "string" },
    storyEngine: { type: "string" },
    protagonistRole: { type: "string" },
    coreConflict: { type: "string" },
    distinctiveHook: { type: "string" },
    narratorIntro: { type: "string" },
    biographyArc: {
      type: "object",
      additionalProperties: false,
      required: [
        "startingSituation",
        "incitingEvent",
        "championConnectionPage4",
        "page5Cliffhanger",
        "finalState",
      ],
      properties: {
        startingSituation: { type: "string" },
        incitingEvent: { type: "string" },
        championConnectionPage4: { type: "string" },
        page5Cliffhanger: { type: "string" },
        finalState: { type: "string" },
      },
    },
    championConnection: {
      type: "object",
      additionalProperties: false,
      required: ["championName", "connectionType", "connectionSummary", "canonSafetyNote"],
      properties: {
        championName: { type: "string" },
        connectionType: { type: "string" },
        connectionSummary: { type: "string" },
        canonSafetyNote: { type: "string" },
      },
    },
    originalityProfile: {
      type: "object",
      additionalProperties: false,
      required: ["specificRole", "dailyReality", "regionalPressure", "unusualStoryElement", "repetitionAvoided"],
      properties: {
        specificRole: { type: "string" },
        dailyReality: { type: "string" },
        regionalPressure: { type: "string" },
        unusualStoryElement: { type: "string" },
        repetitionAvoided: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    characterBible: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "gender",
        "characterType",
        "legendaryTitle",
        "region",
        "socialRole",
        "visualIdentity",
        "clothing",
        "faceAndBody",
        "aura",
        "symbolicObject",
        "colorPalette",
        "worldRules",
        "runeterraLoreAnchor",
      ],
      properties: {
        name: { type: "string" },
        gender: { type: "string" },
        characterType: { type: "string" },
        legendaryTitle: { type: "string" },
        region: { type: "string" },
        socialRole: { type: "string" },
        visualIdentity: { type: "string" },
        clothing: { type: "string" },
        faceAndBody: { type: "string" },
        aura: { type: "string" },
        symbolicObject: { type: "string" },
        colorPalette: { type: "string" },
        worldRules: { type: "string" },
        runeterraLoreAnchor: { type: "string" },
      },
    },
    pages: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageNumber", "chapter", "title", "text", "visualDirection", "imagePrompt"],
        properties: {
          pageNumber: { type: "integer", minimum: 1, maximum: 8 },
          chapter: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          continuityNote: { type: "string" },
          visualDirection: {
            type: "object",
            additionalProperties: false,
            required: ["sceneType", "cameraShot", "characterAction", "environment", "keyObjects", "mood", "lighting"],
            properties: {
              sceneType: { type: "string" },
              cameraShot: { type: "string" },
              characterAction: { type: "string" },
              environment: { type: "string" },
              keyObjects: {
                type: "array",
                items: { type: "string" },
              },
              mood: { type: "string" },
              lighting: { type: "string" },
            },
          },
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
    max_output_tokens: 5000,
  });

  return parseLoreBook(getResponseText(response));
}

async function generateLoreBook(input: BookFormInput) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OpenAI is not configured. Returning fallback lore book.");
    return buildFallbackLoreBook(input);
  }

  const attempts = [{ label: "json_schema", useSchema: true }];

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

    // Keep this route fast: image generation happens through /api/generate-image.
    // The client waits for the first two image calls before revealing the book.
    return NextResponse.json({ book: loreBook });
  } catch (error) {
    console.error("Book generation failed.", error);
    return NextResponse.json({ error: "The archives refused to open. Try again." }, { status: 500 });
  }
}
