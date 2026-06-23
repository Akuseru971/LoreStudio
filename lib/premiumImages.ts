import "server-only";

import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markPageImageFailed,
  saveBookAsset,
} from "@/lib/bookStore";
import { getImageForPage, getReadyIllustrationCount, isIllustrationReady } from "@/lib/book-images";
import { generateBookPageImage } from "@/lib/images";
import { logImageGenerationStepError } from "@/lib/server/with-retry";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import type { StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";
import {
  allBookImagesReady,
  buildPageImageStates,
  resolvePageImageStatus,
} from "@/lib/imageStatus";

type PremiumImagePageResult = {
  pageNumber: number;
  status: "generated" | "skipped" | "failed";
  error?: string;
};

export type PremiumImageGenerationResult = {
  book: StoredBook;
  images: ReturnType<typeof buildPageImageStates>;
  allReady: boolean;
  readyImagesCount: number;
  generatedPages: number[];
  failedPages: number[];
  skippedPages: number[];
  routeStatus: "ready" | "partial" | "failed";
};

function getBookImageInput(storedBook: StoredBook) {
  return {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages: (storedBook.full_book || storedBook.free_book)?.pages,
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

async function generateSinglePremiumImage(
  accessToken: string,
  pageNumber: number,
): Promise<PremiumImagePageResult> {
  console.log("[IMAGE_STEP_START]", { pageNumber, type: "premium_page" });

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const image = getImageForPage(getBookImageInput(storedBook), pageNumber);
  if (isIllustrationReady(image)) {
    return { pageNumber, status: "skipped" };
  }

  const pageStatus = resolvePageImageStatus(storedBook, pageNumber);
  if (pageStatus === "generating") {
    return { pageNumber, status: "skipped" };
  }

  const claimedBook = await claimPageImageGeneration(storedBook.id, pageNumber);
  if (!claimedBook) {
    return { pageNumber, status: "skipped" };
  }

  const sourceBook = claimedBook.full_book || claimedBook.free_book;
  if (!sourceBook) {
    const message = "Book content is missing.";
    await markPageImageFailed(claimedBook.id, pageNumber, message);
    return { pageNumber, status: "failed", error: message };
  }

  const book = normalizeLoreBook(sourceBook);
  const page = book.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    const message = `Page ${pageNumber} is missing.`;
    await markPageImageFailed(claimedBook.id, pageNumber, message);
    return { pageNumber, status: "failed", error: message };
  }

  try {
    const imageRef = await generateBookPageImage(book, page, {
      fallbackOnFailure: true,
      maxAttempts: 3,
    });

    if (!imageRef) {
      const message = `Unable to generate image for page ${pageNumber}.`;
      await markPageImageFailed(claimedBook.id, pageNumber, message);
      return { pageNumber, status: "failed", error: message };
    }

    console.log("[BOOK_IMAGE_DB_UPDATE_START]", { pageNumber });
    await saveBookAsset(accessToken, pageNumber, "image", imageRef);
    console.log("[BOOK_IMAGE_DB_UPDATE_SUCCESS]", { pageNumber });

    return { pageNumber, status: "generated" };
  } catch (error) {
    const message = safeErrorMessage(error);
    logImageGenerationStepError(pageNumber, "premium_persist", error);
    await markPageImageFailed(claimedBook.id, pageNumber, message).catch((markError) => {
      console.error("[BOOK_IMAGE_DB_UPDATE_ERROR]", { pageNumber, markError });
    });
    return { pageNumber, status: "failed", error: message };
  }
}

function summarizePremiumResults(pageResults: PremiumImagePageResult[], finalBook: StoredBook): PremiumImageGenerationResult {
  const generatedPages = pageResults.filter((result) => result.status === "generated").map((result) => result.pageNumber);
  const failedPages = pageResults.filter((result) => result.status === "failed").map((result) => result.pageNumber);
  const skippedPages = pageResults.filter((result) => result.status === "skipped").map((result) => result.pageNumber);
  const imageInput = getBookImageInput(finalBook);
  const readyImagesCount = getReadyIllustrationCount(imageInput);
  const allReady = allBookImagesReady(finalBook);

  let routeStatus: PremiumImageGenerationResult["routeStatus"] = "partial";
  if (allReady) {
    routeStatus = "ready";
  } else if (generatedPages.length === 0 && failedPages.length > 0 && readyImagesCount === 0) {
    routeStatus = "failed";
  }

  return {
    book: finalBook,
    images: buildPageImageStates(finalBook),
    allReady,
    readyImagesCount,
    generatedPages,
    failedPages,
    skippedPages,
    routeStatus,
  };
}

export async function generatePremiumImages(accessToken: string): Promise<PremiumImageGenerationResult> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const latestBook = await getBookByAccessToken(accessToken);
  if (!latestBook) {
    throw new Error("Book not found.");
  }

  const pagesToGenerate = PREMIUM_IMAGE_PAGE_NUMBERS.filter((pageNumber) => {
    const image = getImageForPage(getBookImageInput(latestBook), pageNumber);
    if (isIllustrationReady(image)) {
      return false;
    }

    const status = resolvePageImageStatus(latestBook, pageNumber);
    return status !== "generating";
  });

  const settledResults = await Promise.allSettled(
    pagesToGenerate.map((pageNumber) => generateSinglePremiumImage(accessToken, pageNumber)),
  );

  const pageResults: PremiumImagePageResult[] = settledResults.map((result, index) => {
    const pageNumber = pagesToGenerate[index];
    if (result.status === "fulfilled") {
      return result.value;
    }

    const message = safeErrorMessage(result.reason);
    console.error("[IMAGE_GENERATION_ERROR] Premium image generation failed for page", pageNumber, result.reason);
    void markPageImageFailed(latestBook.id, pageNumber, message).catch((error) => {
      console.error("[BOOK_IMAGE_DB_UPDATE_ERROR]", { pageNumber, error });
    });
    return { pageNumber, status: "failed", error: message };
  });

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found.");
  }

  console.log("[IMAGE_READY_COUNT]", buildPageImageStates(finalBook));

  return summarizePremiumResults(pageResults, finalBook);
}

export async function ensureAllBookImagesReady(accessToken: string, maxWaitMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const result = await generatePremiumImages(accessToken);
    if (result.allReady) {
      const sourceBook = result.book.full_book || result.book.free_book;
      if (!sourceBook) {
        throw new Error("Book content is missing.");
      }

      const { mergeBookAssets } = await import("@/lib/bookStore");
      const mergedBook = await mergeBookAssets(sourceBook, result.book.images, result.book.audio);
      return { book: mergedBook, storedBook: result.book };
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("Illustrations are still being prepared. Please try again shortly.");
}

export function triggerPremiumImageGeneration(accessToken: string) {
  void generatePremiumImages(accessToken).catch((error) => {
    console.error("Background premium image generation failed.", error);
  });
}
