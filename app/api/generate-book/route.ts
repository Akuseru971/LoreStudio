import { NextResponse } from "next/server";
import { createFreeBook, findExistingGenerationBook, mergeBookAssets, updateFreeBook } from "@/lib/bookStore";
import { startEarlyPage1ImageGeneration } from "@/lib/freeImages";
import { TEXT_MODEL } from "@/lib/server/generation-config";
import { generateLoreBookPhase1, generateLoreBookPhase2, isDevOrPreview } from "@/lib/loreGeneration";
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
    const phase1Result = await generateLoreBookPhase1(input, approvedSynopsis);
    console.timeEnd("[TEXT_GENERATION]");

    console.time("[SUPABASE_SAVE]");
    const storedBook = await createFreeBook(input, phase1Result.book, approvedSynopsis ?? null);
    console.timeEnd("[SUPABASE_SAVE]");

    const accessToken = storedBook.access_token;
    const earlyPage1ImagePromise = startEarlyPage1ImageGeneration({
      accessToken,
      bookId: storedBook.id,
      book: phase1Result.book,
    }).catch((error) => {
      console.error("[EARLY_PAGE_1_IMAGE_GENERATION_ERROR]", {
        bookId: storedBook.id,
        error,
      });
    });

    console.time("[TEXT_GENERATION_PHASE_2]");
    const phase2Result = phase1Result.fallback
      ? phase1Result
      : await generateLoreBookPhase2(phase1Result.book, input, approvedSynopsis);
    console.log("[TEXT_GENERATION_DONE]", Date.now());
    console.timeEnd("[TEXT_GENERATION_PHASE_2]");

    let activeBook = storedBook;
    if (!phase1Result.fallback) {
      activeBook = await updateFreeBook(storedBook.id, phase2Result.book);
    }

    void earlyPage1ImagePromise;

    console.time("[IMAGE_PROMPTS_READY]");
    const mergedBook = await mergeBookAssets(phase2Result.book, activeBook.images, activeBook.audio);
    console.timeEnd("[IMAGE_PROMPTS_READY]");
    const book = normalizeBook(mergedBook);
    if (!book) {
      throw new Error("The generated book could not be prepared for reading.");
    }

    console.log("[GENERATE_BOOK_RETURN]", Date.now());
    console.timeEnd("[GENERATE_BOOK_TOTAL]");

    return NextResponse.json({
      book,
      accessToken,
      fallback: phase1Result.fallback || phase2Result.fallback,
      imagesQueued: true,
    });
  } catch (error) {
    console.error("[API_GENERATE_BOOK_ERROR]", error);
    console.timeEnd("[GENERATE_BOOK_TOTAL]");
    return buildErrorResponse(error);
  }
}
