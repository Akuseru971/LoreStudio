import { NextResponse } from "next/server";
import { createFreeBook, findExistingGenerationBook, mergeBookAssets } from "@/lib/bookStore";
import { TEXT_MODEL } from "@/lib/server/generation-config";
import { generateLoreBook, isDevOrPreview } from "@/lib/loreGeneration";
import { normalizeBook } from "@/lib/normalizeBook";
import { validateGenerateBookRequest } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function buildErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The archives refused to open. Try again.";

  if (isDevOrPreview()) {
    return NextResponse.json(
      {
        error: message,
        debug: {
          name: error instanceof Error ? error.name : "Error",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: "The archives refused to open. Try again." }, { status: 500 });
}

export async function POST(request: Request) {
  console.time("[GENERATE_BOOK_TOTAL]");
  console.log("[GENERATE_BOOK_START]", Date.now());
  console.log("[BOOK_TEXT_MODEL_USED]", TEXT_MODEL);

  try {
    const body = await request.json();
    const { input, approvedSynopsis, error } = validateGenerateBookRequest(body);
    if (!input) {
      console.timeEnd("[GENERATE_BOOK_TOTAL]");
      return NextResponse.json({ error: error || "Invalid input." }, { status: 400 });
    }

    const existingBook = await findExistingGenerationBook(input, approvedSynopsis ?? null);
    if (existingBook?.free_book) {
      console.log("[GENERATE_BOOK_REUSED_EXISTING]", {
        accessToken: existingBook.access_token,
        at: Date.now(),
      });

      const mergedBook = await mergeBookAssets(existingBook.free_book, existingBook.images, existingBook.audio);
      const book = normalizeBook(mergedBook);
      if (!book) {
        throw new Error("The generated book could not be prepared for reading.");
      }

      console.log("[GENERATE_BOOK_RETURN]", Date.now());
      console.timeEnd("[GENERATE_BOOK_TOTAL]");

      return NextResponse.json({
        book,
        accessToken: existingBook.access_token,
        fallback: false,
        reused: true,
        imagesQueued: true,
      });
    }

    console.time("[TEXT_GENERATION]");
    console.log("[TEXT_GENERATION_START]", Date.now());
    const loreResult = await generateLoreBook(input, approvedSynopsis);
    console.log("[TEXT_GENERATION_DONE]", Date.now());
    console.timeEnd("[TEXT_GENERATION]");

    console.time("[IMAGE_PROMPTS_READY]");
    console.time("[SUPABASE_SAVE]");
    const storedBook = await createFreeBook(input, loreResult.book, approvedSynopsis ?? null);
    console.timeEnd("[SUPABASE_SAVE]");
    console.timeEnd("[IMAGE_PROMPTS_READY]");

    const accessToken = storedBook.access_token;
    const mergedBook = await mergeBookAssets(loreResult.book, storedBook.images, storedBook.audio);
    const book = normalizeBook(mergedBook);
    if (!book) {
      throw new Error("The generated book could not be prepared for reading.");
    }

    console.log("[GENERATE_BOOK_RETURN]", Date.now());
    console.timeEnd("[GENERATE_BOOK_TOTAL]");

    return NextResponse.json({
      book,
      accessToken,
      fallback: loreResult.fallback,
      imagesQueued: true,
    });
  } catch (error) {
    console.error("[API_GENERATE_BOOK_ERROR]", error);
    console.timeEnd("[GENERATE_BOOK_TOTAL]");
    return buildErrorResponse(error);
  }
}
