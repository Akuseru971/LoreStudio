import { NextResponse } from "next/server";
import { createFreeBook, mergeBookAssets } from "@/lib/bookStore";
import { generateFreeBookImages } from "@/lib/freeImages";
import { generateLoreBook, isDevOrPreview } from "@/lib/loreGeneration";
import { validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  console.log("[API_GENERATE_BOOK_START]", Date.now());

  try {
    const body = await request.json();
    const { input, error } = validateBookInput(body);
    if (!input) {
      return NextResponse.json({ error: error || "Invalid input." }, { status: 400 });
    }

    console.log("[LORE_GENERATION_START]", Date.now());
    const loreResult = await generateLoreBook(input);
    console.log("[LORE_GENERATION_DONE]", Date.now());

    const storedBook = await createFreeBook(input, loreResult.book);
    const accessToken = storedBook.access_token;

    console.log("[FREE_IMAGES_START]", Date.now());
    const updatedStoredBook = await generateFreeBookImages(accessToken, loreResult.book);
    console.log("[FREE_IMAGES_DONE]", Date.now());

    const mergedBook = await mergeBookAssets(loreResult.book, updatedStoredBook.images, updatedStoredBook.audio);

    console.log("[API_GENERATE_BOOK_DONE]", Date.now());

    return NextResponse.json({
      book: mergedBook,
      accessToken,
      fallback: loreResult.fallback,
    });
  } catch (error) {
    console.error("[API_GENERATE_BOOK_ERROR]", error);
    return buildErrorResponse(error);
  }
}
