import { NextResponse } from "next/server";
import { getBookByAccessToken, mergeBookAssets } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { countReadyFreeImages, generateNextFreeImage } from "@/lib/freeImages";
import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
import { normalizeBook } from "@/lib/normalizeBook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type GenerateNextFreeImageBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateNextFreeImageBody;
  const accessToken = body.accessToken?.trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await generateNextFreeImage(accessToken);
    const normalized = getNormalizedImagesForStoredBook(result.storedBook);
    const sourceBook = result.storedBook.free_book;
    const mergedBook = sourceBook
      ? await mergeBookAssets(sourceBook, normalized.normalizedImages, result.storedBook.audio)
      : null;
    const book = mergedBook ? normalizeBook(mergedBook) : null;

    return NextResponse.json({
      success: true,
      status: result.allFreeImagesReady ? "ready_free" : "generating_images",
      message: result.allFreeImagesReady ? "Free illustrations are ready." : "Generation still in progress",
      accessToken,
      pageNumber: result.pageNumber,
      generated: result.generated,
      done: result.done,
      allFreeImagesReady: result.allFreeImagesReady,
      readyFreeImageCount: result.readyFreeImageCount,
      freeImagesTotal: FREE_IMAGE_PAGE_COUNT,
      missingFreePages: result.missingFreePages,
      retryable: "retryable" in result ? result.retryable : undefined,
      reason: "reason" in result ? result.reason : undefined,
      imageStatus: normalized.images,
      book,
    });
  } catch (error) {
    console.error("[GENERATE_NEXT_FREE_IMAGE_ERROR]", error);

    const storedBook = await getBookByAccessToken(accessToken);
    if (storedBook) {
      const normalized = getNormalizedImagesForStoredBook(storedBook);
      const readyFreeImageCount = countReadyFreeImages(storedBook);

      return NextResponse.json({
        success: true,
        status: "generating_images",
        message: "Generation still in progress",
        retryable: true,
        accessToken,
        generated: false,
        done: false,
        allFreeImagesReady: readyFreeImageCount >= FREE_IMAGE_PAGE_COUNT,
        readyFreeImageCount,
        freeImagesTotal: FREE_IMAGE_PAGE_COUNT,
        imageStatus: normalized.images,
      });
    }

    const message = error instanceof Error ? error.message : "Unable to generate free image.";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
