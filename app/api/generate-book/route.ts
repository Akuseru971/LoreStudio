import { after, NextResponse } from "next/server";
import { createFreeBook, findExistingGenerationBook, mergeBookAssets } from "@/lib/bookStore";
import { TEXT_MODEL } from "@/lib/server/generation-config";
import { continueBookTextPhase2, generateLoreBookPhase1, isDevOrPreview } from "@/lib/loreGeneration";
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

    console.log("[GENERATE_BOOK_PHASE_1_START]");
    console.time("[TEXT_GENERATION]");
    console.log("[TEXT_GENERATION_START]", Date.now());
    const phase1Result = await generateLoreBookPhase1(input, approvedSynopsis);
    console.timeEnd("[TEXT_GENERATION]");

    const phase1Book = phase1Result.book;
    console.log("[GENERATE_BOOK_PHASE_1_DONE]", {
      hasStoryBible: Boolean(phase1Book.storyEngine?.archetype),
      hasVisualIdentity: Boolean(phase1Book.visualBible?.appearance),
      hasPage1: Boolean(phase1Book.pages[0]?.text?.trim()),
      hasPage2: Boolean(phase1Book.pages[1]?.text?.trim()),
    });

    console.time("[SUPABASE_SAVE]");
    const storedBook = await createFreeBook(input, phase1Book, approvedSynopsis ?? null);
    console.timeEnd("[SUPABASE_SAVE]");

    const accessToken = storedBook.access_token;

    if (!phase1Result.fallback) {
      after(async () => {
        await continueBookTextPhase2(storedBook.id, phase1Book, input, approvedSynopsis ?? null);
      });
    }

    const mergedBook = await mergeBookAssets(phase1Book, storedBook.images, storedBook.audio);
    const book = normalizeBook(mergedBook);
    if (!book) {
      throw new Error("The generated book could not be prepared for reading.");
    }

    console.log("[GENERATE_BOOK_EARLY_RETURN_READY]", {
      bookId: storedBook.id,
      accessToken,
    });
    console.log("[GENERATE_BOOK_RETURN]", Date.now());
    console.timeEnd("[GENERATE_BOOK_TOTAL]");

    return NextResponse.json({
      book,
      accessToken,
      fallback: phase1Result.fallback,
      imagesQueued: true,
    });
  } catch (error) {
    console.error("[API_GENERATE_BOOK_ERROR]", error);
    console.timeEnd("[GENERATE_BOOK_TOTAL]");
    return buildErrorResponse(error);
  }
}
