import "server-only";

import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import { checkBookReadyAndFinalize } from "@/lib/bookCompletion";
import { getBookReadinessSummary } from "@/lib/book-readiness";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markPageImageFailed,
  saveBookAsset,
} from "@/lib/bookStore";
import { getImageForPage, isIllustrationReady } from "@/lib/book-images";
import { generateBookPageImage } from "@/lib/images";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";
import {
  allBookImagesReady,
  buildPageImageStates,
  resolvePageImageStatus,
} from "@/lib/imageStatus";

async function generateSinglePremiumImage(accessToken: string, pageNumber: number) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const image = getImageForPage(
    {
      images: storedBook.images,
      imageStatus: storedBook.image_status,
      pages: (storedBook.full_book || storedBook.free_book)?.pages,
    },
    pageNumber,
  );

  if (isIllustrationReady(image)) {
    return storedBook;
  }

  const status = resolvePageImageStatus(storedBook, pageNumber);
  if (status === "generating") {
    return storedBook;
  }

  const claimedBook = await claimPageImageGeneration(storedBook.id, pageNumber);
  if (!claimedBook) {
    return getBookByAccessToken(accessToken);
  }

  const sourceBook = claimedBook.full_book || claimedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  const book = normalizeLoreBook(sourceBook);
  const page = book.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    throw new Error(`Page ${pageNumber} is missing.`);
  }

  try {
    const imageUrl = await generateBookPageImage(book, page, {
      fallbackOnFailure: true,
      maxAttempts: 2,
    });

    if (!imageUrl) {
      await markPageImageFailed(claimedBook.id, pageNumber);
      throw new Error(`Unable to generate image for page ${pageNumber}.`);
    }

    return saveBookAsset(accessToken, pageNumber, "image", imageUrl);
  } catch (error) {
    await markPageImageFailed(claimedBook.id, pageNumber);
    throw error;
  }
}

export function findNextMissingPremiumPage(storedBook: NonNullable<Awaited<ReturnType<typeof getBookByAccessToken>>>) {
  for (const pageNumber of PREMIUM_IMAGE_PAGE_NUMBERS) {
    const image = getImageForPage(
      {
        images: storedBook.images,
        imageStatus: storedBook.image_status,
        pages: (storedBook.full_book || storedBook.free_book)?.pages,
      },
      pageNumber,
    );

    if (isIllustrationReady(image)) {
      continue;
    }

    const status = resolvePageImageStatus(storedBook, pageNumber);
    if (status === "generating") {
      return { pageNumber, status: "generating" as const };
    }

    if (status === "failed" || status === "not_started") {
      return { pageNumber, status };
    }
  }

  return null;
}

export type GenerateNextPremiumImageResult = {
  done: boolean;
  pageNumber: number | null;
  pageStatus: string | null;
  readyImagesCount: number;
  totalImages: number;
  missingPremiumPages: number[];
  failedPages: number[];
  bookStatus: string;
  isReady: boolean;
  generated: boolean;
};

export async function generateNextPremiumImage(accessToken: string): Promise<GenerateNextPremiumImageResult> {
  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_START]", accessToken);

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const summary = getBookReadinessSummary(storedBook);
  const nextPage = findNextMissingPremiumPage(storedBook);

  if (!nextPage) {
    const readyResult = await checkBookReadyAndFinalize(accessToken);
    console.log("[GENERATE_NEXT_PREMIUM_IMAGE_DONE]", { accessToken, done: true });

    return {
      done: true,
      pageNumber: null,
      pageStatus: null,
      readyImagesCount: readyResult.readyImagesCount,
      totalImages: readyResult.totalImages,
      missingPremiumPages: [],
      failedPages: summary.failedPages,
      bookStatus: readyResult.status,
      isReady: readyResult.isReady,
      generated: false,
    };
  }

  if (nextPage.status === "generating") {
    console.log("[GENERATE_NEXT_PREMIUM_IMAGE_PAGE_SELECTED]", {
      accessToken,
      pageNumber: nextPage.pageNumber,
      skipped: "already_generating",
    });

    return {
      done: false,
      pageNumber: nextPage.pageNumber,
      pageStatus: "generating",
      readyImagesCount: summary.readyImagesCount,
      totalImages: summary.totalImages,
      missingPremiumPages: summary.missingPremiumPages,
      failedPages: summary.failedPages,
      bookStatus: storedBook.status,
      isReady: false,
      generated: false,
    };
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_PAGE_SELECTED]", {
    accessToken,
    pageNumber: nextPage.pageNumber,
    status: nextPage.status,
  });

  try {
    await generateSinglePremiumImage(accessToken, nextPage.pageNumber);
  } catch (error) {
    console.error("[GENERATE_NEXT_PREMIUM_IMAGE_FAILED]", {
      accessToken,
      pageNumber: nextPage.pageNumber,
      error,
    });
  }

  const latestBook = await getBookByAccessToken(accessToken);
  if (!latestBook) {
    throw new Error("Book not found after image generation.");
  }

  const latestSummary = getBookReadinessSummary(latestBook);
  const stillMissing = findNextMissingPremiumPage(latestBook);

  if (!stillMissing) {
    const readyResult = await checkBookReadyAndFinalize(accessToken);
    console.log("[GENERATE_NEXT_PREMIUM_IMAGE_DONE]", {
      accessToken,
      pageNumber: nextPage.pageNumber,
      done: true,
    });

    return {
      done: true,
      pageNumber: nextPage.pageNumber,
      pageStatus: "ready",
      readyImagesCount: readyResult.readyImagesCount,
      totalImages: readyResult.totalImages,
      missingPremiumPages: [],
      failedPages: latestSummary.failedPages,
      bookStatus: readyResult.status,
      isReady: readyResult.isReady,
      generated: true,
    };
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_DONE]", {
    accessToken,
    pageNumber: nextPage.pageNumber,
    done: false,
  });

  return {
    done: false,
    pageNumber: nextPage.pageNumber,
    pageStatus: resolvePageImageStatus(latestBook, nextPage.pageNumber),
    readyImagesCount: latestSummary.readyImagesCount,
    totalImages: latestSummary.totalImages,
    missingPremiumPages: latestSummary.missingPremiumPages,
    failedPages: latestSummary.failedPages,
    bookStatus: latestBook.status,
    isReady: false,
    generated: true,
  };
}

export async function generatePremiumImages(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  for (const pageNumber of PREMIUM_IMAGE_PAGE_NUMBERS) {
    const latestBook = await getBookByAccessToken(accessToken);
    if (!latestBook) {
      break;
    }

    const image = getImageForPage(
      {
        images: latestBook.images,
        imageStatus: latestBook.image_status,
        pages: (latestBook.full_book || latestBook.free_book)?.pages,
      },
      pageNumber,
    );

    if (isIllustrationReady(image)) {
      continue;
    }

    const status = resolvePageImageStatus(latestBook, pageNumber);
    if (status === "generating") {
      continue;
    }

    try {
      await generateSinglePremiumImage(accessToken, pageNumber);
    } catch (error) {
      console.error(`[IMAGE_GENERATION_ERROR] Premium image generation failed for page ${pageNumber}.`, error);
    }
  }

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found.");
  }

  console.log("[IMAGE_READY_COUNT]", buildPageImageStates(finalBook));

  return {
    book: finalBook,
    images: buildPageImageStates(finalBook),
    allReady: allBookImagesReady(finalBook),
  };
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
  void generateNextPremiumImage(accessToken).catch((error) => {
    console.error("Background premium image generation failed.", error);
  });
}
