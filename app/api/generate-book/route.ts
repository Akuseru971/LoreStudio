import { NextResponse } from "next/server";
import { buildFinalImagePrompt, buildLorePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { LoreBook } from "@/lib/types";
import { dataUrlFromBase64, normalizeLoreBook, validateBookInput } from "@/lib/utils";

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

async function generatePageImage(book: LoreBook, pageIndex: number) {
  const page = book.pages[pageIndex];
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const prompt = buildFinalImagePrompt(book, page);

  async function requestImage(size: "1024x1536" | "1024x1024") {
    return openai.images.generate({
      model,
      prompt,
      size,
      response_format: "b64_json",
    });
  }

  try {
    let response;
    try {
      response = await requestImage("1024x1536");
    } catch (portraitError) {
      console.warn("Portrait image generation failed; retrying square image.", portraitError);
      response = await requestImage("1024x1024");
    }

    const image = response.data?.[0];
    if (image?.b64_json) {
      return dataUrlFromBase64(image.b64_json, "image/png");
    }

    if (image?.url) {
      return image.url;
    }
  } catch (error) {
    console.warn(`Image generation failed for page ${page.pageNumber}.`, error);
  }

  return undefined;
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

    // MVP note: eight image generations can be slow on serverless functions. This
    // keeps the first build simple with allSettled, while preserving graceful
    // placeholders. A production scale-up can move images to background jobs.
    const imageResults = await Promise.allSettled(loreBook.pages.map((_, index) => generatePageImage(loreBook, index)));

    const pages = loreBook.pages.map((page, index) => ({
      ...page,
      imageUrl: imageResults[index].status === "fulfilled" ? imageResults[index].value : undefined,
    }));

    return NextResponse.json({ book: { ...loreBook, pages } });
  } catch (error) {
    console.error("Book generation failed.", error);
    return NextResponse.json({ error: "The archives refused to open. Try again." }, { status: 500 });
  }
}
