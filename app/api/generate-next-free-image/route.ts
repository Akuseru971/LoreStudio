import { NextResponse } from "next/server";
import { mergeBookAssets } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { generateNextFreeImage } from "@/lib/freeImages";
import { normalizeBook } from "@/lib/normalizeBook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type GenerateNextFreeImageBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateNextFreeImageBody;
    const accessToken = body.accessToken?.trim();

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const result = await generateNextFreeImage(accessToken);
    const normalized = getNormalizedImagesForStoredBook(result.storedBook);
    const sourceBook = result.storedBook.free_book;
    const mergedBook = sourceBook
      ? await mergeBookAssets(sourceBook, normalized.normalizedImages, result.storedBook.audio)
      : null;
    const book = mergedBook ? normalizeBook(mergedBook) : null;

    return NextResponse.json({
      accessToken,
      pageNumber: result.pageNumber,
      generated: result.generated,
      done: result.done,
      allFreeImagesReady: result.allFreeImagesReady,
      readyFreeImageCount: result.readyFreeImageCount,
      missingFreePages: result.missingFreePages,
      imageStatus: normalized.images,
      book,
    });
  } catch (error) {
    console.error("[GENERATE_NEXT_FREE_IMAGE_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unable to generate free image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
