import { NextResponse } from "next/server";
import { buildLorePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook, validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The lore model did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
}

async function generateLoreBook(input: NonNullable<ReturnType<typeof validateBookInput>["input"]>) {
  const { system, user } = buildLorePrompt(input);
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5";

  const response = await openai.responses.create({
    model,
    instructions: system,
    input: user,
    text: {
      format: { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 6500,
  });

  const rawText = response.output_text;
  const parsed = JSON.parse(extractJson(rawText)) as LoreBook;
  return normalizeLoreBook(parsed);
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI is not configured." }, { status: 500 });
    }

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
