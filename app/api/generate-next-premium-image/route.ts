import { NextResponse } from "next/server";
import { getBookByAccessToken, mergeBookAssets } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import {
  countReadyPremiumImages,
  generateNextPremiumImage,
  getMissingPremiumImagePages,
  PREMIUM_IMAGE_PAGES,
} from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { normalizeBook } from "@/lib/normalizeBook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type GenerateNextPremiumImageBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateNextPremiumImageBody;
  const accessToken = body.accessToken?.trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  if (!hasPremiumAccess(storedBook.status)) {
    return NextResponse.json({ error: "Premium access is required." }, { status: 403 });
  }

  try {
    const result = await generateNextPremiumImage(accessToken);
    const normalized = getNormalizedImagesForStoredBook(result.storedBook);
    const sourceBook = result.storedBook.full_book || result.storedBook.free_book;
    const mergedBook = sourceBook
      ? await mergeBookAssets(sourceBook, normalized.normalizedImages, result.storedBook.audio)
      : null;
    const book = mergedBook ? normalizeBook(mergedBook) : null;

    return NextResponse.json({
      success: true,
      status: result.allIllustrationsReady ? "ready" : "preparing_assets",
      message: result.allIllustrationsReady ? "All illustrations are ready." : "Generation still in progress",
      accessToken,
      generatedPage: result.pageNumber,
      generated: result.generated,
      done: result.done,
      allPremiumImagesReady: result.allPremiumImagesReady,
      allIllustrationsReady: result.allIllustrationsReady,
      readyImagesCount: result.readyIllustrationCount,
      readyPremiumImageCount: result.readyPremiumImageCount,
      premiumImagesTotal: PREMIUM_IMAGE_PAGES.length,
      missingPremiumPages: result.missingPremiumPages,
      imageStatus: normalized.images,
      book,
    });
  } catch (error) {
    console.error("[GENERATE_NEXT_PREMIUM_IMAGE_ERROR]", error);

    const refreshedBook = await getBookByAccessToken(accessToken);
    if (refreshedBook) {
      const normalized = getNormalizedImagesForStoredBook(refreshedBook);
      const readyPremiumImageCount = countReadyPremiumImages(refreshedBook);

      return NextResponse.json({
        success: true,
        status: "preparing_assets",
        message: "Generation still in progress",
        retryable: true,
        accessToken,
        generated: false,
        done: false,
        allPremiumImagesReady: readyPremiumImageCount >= PREMIUM_IMAGE_PAGES.length,
        readyPremiumImageCount,
        premiumImagesTotal: PREMIUM_IMAGE_PAGES.length,
        missingPremiumPages: getMissingPremiumImagePages(refreshedBook),
        imageStatus: normalized.images,
      });
    }

    const message = error instanceof Error ? error.message : "Unable to generate premium image.";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
