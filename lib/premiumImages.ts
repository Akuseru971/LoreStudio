import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markBookReady,
  markPageImageFailed,
  resetStalePageImageGeneration,
  saveBookAsset,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, getReadyIllustrationCount, isIllustrationReady, type BookImagesInput } from "@/lib/book-images";
import { generateBookPageImage } from "@/lib/images";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { IMAGE_GENERATION_TIMEOUT_MS, STALE_IMAGE_GENERATING_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";
import {
  allBookImagesReady,
  buildPageImageStates,
} from "@/lib/imageStatus";

export const PREMIUM_IMAGE_PAGES = [...PREMIUM_IMAGE_PAGE_NUMBERS];

export function getPremiumImagePagesInput(storedBook: StoredBook): BookImagesInput {
  return {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages: (storedBook.full_book || storedBook.free_book)?.pages,
  };
}

export function countReadyPremiumImages(storedBook: StoredBook) {
  const input = getPremiumImagePagesInput(storedBook);
  return PREMIUM_IMAGE_PAGES.filter((pageNumber) => isIllustrationReady(getImageForPage(input, pageNumber))).length;
}

export function getMissingPremiumImagePages(storedBook: StoredBook) {
  const input = getPremiumImagePagesInput(storedBook);
  return PREMIUM_IMAGE_PAGES.filter((pageNumber) => !isIllustrationReady(getImageForPage(input, pageNumber)));
}

export function arePremiumIllustrationsReady(storedBook: StoredBook) {
  return getMissingPremiumImagePages(storedBook).length === 0;
}

function getPageImageGenerationTimestamp(storedBook: StoredBook, pageNumber: number) {
  const raw = storedBook.images[String(pageNumber)];
  if (raw && typeof raw === "object" && raw !== null) {
    const record = raw as { updatedAt?: string | null; startedAt?: string | null };
    return record.updatedAt || record.startedAt || null;
  }

  const input = getPremiumImagePagesInput(storedBook);
  const image = getImageForPage(input, pageNumber);
  return image?.updatedAt || image?.startedAt || null;
}

export function isPremiumImageGeneratingStale(storedBook: StoredBook, pageNumber: number) {
  const input = getPremiumImagePagesInput(storedBook);
  const image = getImageForPage(input, pageNumber);
  if (image?.status !== "generating" || isIllustrationReady(image)) {
    return false;
  }

  const timestamp = getPageImageGenerationTimestamp(storedBook, pageNumber);
  if (!timestamp) {
    return true;
  }

  const updatedTime = new Date(timestamp).getTime();
  if (Number.isNaN(updatedTime)) {
    return true;
  }

  return Date.now() - updatedTime >= STALE_IMAGE_GENERATING_MS;
}

export function getStalePremiumImagePages(storedBook: StoredBook) {
  return PREMIUM_IMAGE_PAGES.filter((pageNumber) => isPremiumImageGeneratingStale(storedBook, pageNumber));
}

export function getPremiumGenerationStatus(storedBook: StoredBook) {
  const input = getPremiumImagePagesInput(storedBook);
  const readyImagesCount = getReadyIllustrationCount(input);
  const missingPremiumPages = getMissingPremiumImagePages(storedBook);
  const stalePremiumPages = getStalePremiumImagePages(storedBook);
  const shouldContinuePremiumGeneration =
    hasPremiumAccess(storedBook.status) && missingPremiumPages.length > 0;

  return {
    readyImagesCount,
    missingPremiumPages,
    stalePremiumPages,
    shouldContinuePremiumGeneration,
  };
}

export async function recoverStalePremiumImages(storedBook: StoredBook) {
  const stalePages = getStalePremiumImagePages(storedBook);
  let latestBook = storedBook;

  for (const pageNumber of stalePages) {
    const timestamp = getPageImageGenerationTimestamp(storedBook, pageNumber);
    console.log("[STALE_PREMIUM_IMAGE_DETECTED]", {
      bookId: storedBook.id,
      pageNumber,
      status: "generating",
      updatedAt: timestamp,
    });

    const resetBook = await resetStalePageImageGeneration(storedBook.id, pageNumber);
    if (resetBook) {
      latestBook = resetBook;
      console.log("[STALE_PREMIUM_IMAGE_RESET_FOR_RETRY]", {
        bookId: storedBook.id,
        pageNumber,
      });
    }
  }

  return latestBook;
}

export function findNextMissingPremiumImagePage(storedBook: StoredBook) {
  const input = getPremiumImagePagesInput(storedBook);

  for (const pageNumber of PREMIUM_IMAGE_PAGES) {
    const image = getImageForPage(input, pageNumber);
    if (isIllustrationReady(image)) {
      console.log("[GENERATE_NEXT_PREMIUM_IMAGE_SKIP_READY]", pageNumber);
      continue;
    }

    if (image?.status === "generating" && !isPremiumImageGeneratingStale(storedBook, pageNumber)) {
      continue;
    }

    if (image?.status === "failed" || image?.status === "generating" || !image || image.status === "not_started") {
      return pageNumber;
    }

    return pageNumber;
  }

  return null;
}

async function generateAndStorePremiumImageForPage({
  accessToken,
  bookId,
  book,
  pageNumber,
}: {
  accessToken: string;
  bookId: string;
  book: LoreBook;
  pageNumber: number;
}) {
  const claimedBook = await claimPageImageGeneration(bookId, pageNumber);
  if (!claimedBook) {
    return getBookByAccessToken(accessToken);
  }

  const normalizedBook = normalizeLoreBook(book);
  const page = normalizedBook.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    await markPageImageFailed(bookId, pageNumber);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: `Page ${pageNumber} is missing.`,
    });
    return null;
  }

  try {
    const imageUrl = await withTimeout(
      generateBookPageImage(normalizedBook, page, {
        fallbackOnFailure: false,
        maxAttempts: 2,
      }),
      IMAGE_GENERATION_TIMEOUT_MS,
      `PREMIUM_IMAGE_PAGE_${pageNumber}`,
    );

    if (!imageUrl) {
      await markPageImageFailed(bookId, pageNumber);
      console.error("[IMAGE_GENERATION_ERROR]", {
        pageNumber,
        message: "No image URL returned.",
      });
      return null;
    }

    return saveBookAsset(accessToken, pageNumber, "image", imageUrl);
  } catch (error) {
    await markPageImageFailed(bookId, pageNumber);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: error instanceof Error ? error.message : "Image generation failed.",
    });
    return null;
  }
}

async function markPremiumAssetsReadyIfComplete(storedBook: StoredBook) {
  if (!allBookImagesReady(storedBook)) {
    await updateGenerationProgress(storedBook.id, "preparing", { generationError: null });
    return storedBook;
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_ALL_READY]");
  await updateGenerationProgress(storedBook.id, "ready_free", { generationError: null });

  if (hasPremiumAccess(storedBook.status) && storedBook.status !== "ready") {
    return markBookReady(storedBook.id);
  }

  return getBookByAccessToken(storedBook.access_token);
}

export async function generateNextPremiumImage(accessToken: string) {
  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_START]");

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const recoveredBook = await recoverStalePremiumImages(storedBook);
  const workingBook = recoveredBook || storedBook;
  const generationStatus = getPremiumGenerationStatus(workingBook);
  console.log("[PREMIUM_GENERATION_STATUS]", {
    bookId: workingBook.id,
    readyImagesCount: generationStatus.readyImagesCount,
    missingPremiumPages: generationStatus.missingPremiumPages,
    stalePremiumPages: generationStatus.stalePremiumPages,
  });
  console.log("[PREMIUM_GENERATION_NOT_DEPENDENT_ON_BOOK_OPEN]");

  const sourceBook = workingBook.full_book || workingBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  if (arePremiumIllustrationsReady(workingBook) && allBookImagesReady(workingBook)) {
    const readyBook = await markPremiumAssetsReadyIfComplete(workingBook);
    return {
      storedBook: readyBook || workingBook,
      pageNumber: null,
      generated: false,
      done: true,
      allPremiumImagesReady: true,
      allIllustrationsReady: true,
      readyPremiumImageCount: PREMIUM_IMAGE_PAGES.length,
      readyIllustrationCount: FULL_BOOK_PAGE_COUNT,
      missingPremiumPages: [] as number[],
      stalePremiumPages: [] as number[],
      shouldContinuePremiumGeneration: false,
    };
  }

  const pageNumber = findNextMissingPremiumImagePage(workingBook);
  if (!pageNumber) {
    const refreshedBook = await getBookByAccessToken(accessToken);
    if (!refreshedBook) {
      throw new Error("Book not found.");
    }

    const allPremiumImagesReady = arePremiumIllustrationsReady(refreshedBook);
    const allIllustrationsReady = allBookImagesReady(refreshedBook);
    const status = getPremiumGenerationStatus(refreshedBook);
    const readyBook =
      allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

    return {
      storedBook: readyBook || refreshedBook,
      pageNumber: null,
      generated: false,
      done: allPremiumImagesReady,
      allPremiumImagesReady,
      allIllustrationsReady,
      readyPremiumImageCount: countReadyPremiumImages(refreshedBook),
      readyIllustrationCount: getReadyIllustrationCount({
        images: refreshedBook.images,
        imageStatus: refreshedBook.image_status,
        pages: (refreshedBook.full_book || refreshedBook.free_book)?.pages,
      }),
      missingPremiumPages: status.missingPremiumPages,
      stalePremiumPages: status.stalePremiumPages,
      shouldContinuePremiumGeneration: status.shouldContinuePremiumGeneration,
    };
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_SELECTED_PAGE]", pageNumber);
  await updateGenerationProgress(workingBook.id, "preparing", { generationError: null });

  await generateAndStorePremiumImageForPage({
    accessToken,
    bookId: workingBook.id,
    book: sourceBook,
    pageNumber,
  });

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_DONE]", pageNumber);

  const refreshedBook = await getBookByAccessToken(accessToken);
  if (!refreshedBook) {
    throw new Error("Book not found after image generation.");
  }

  const missingPremiumPages = getMissingPremiumImagePages(refreshedBook);
  const allPremiumImagesReady = missingPremiumPages.length === 0;
  const allIllustrationsReady = allBookImagesReady(refreshedBook);
  const status = getPremiumGenerationStatus(refreshedBook);
  const readyBook =
    allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

  return {
    storedBook: readyBook || refreshedBook,
    pageNumber,
    generated: true,
    done: allPremiumImagesReady,
    allPremiumImagesReady,
    allIllustrationsReady,
    readyPremiumImageCount: countReadyPremiumImages(refreshedBook),
    readyIllustrationCount: getReadyIllustrationCount({
      images: refreshedBook.images,
      imageStatus: refreshedBook.image_status,
      pages: (refreshedBook.full_book || refreshedBook.free_book)?.pages,
    }),
    missingPremiumPages: status.missingPremiumPages,
    stalePremiumPages: status.stalePremiumPages,
    shouldContinuePremiumGeneration: status.shouldContinuePremiumGeneration,
  };
}

export async function generatePremiumImages(accessToken: string) {
  console.log("[PREMIUM_IMAGE_GENERATION_PAGES]", [...PREMIUM_IMAGE_PAGE_NUMBERS]);

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  const result = await generateNextPremiumImage(accessToken);
  const finalBook = result.storedBook;
  console.log("[IMAGE_READY_COUNT]", buildPageImageStates(finalBook));

  return {
    book: finalBook,
    images: buildPageImageStates(finalBook),
    allReady: result.allIllustrationsReady,
  };
}

export function triggerPremiumImageGeneration(_accessToken: string) {
  console.log("[PREMIUM_IMAGE_GENERATION_DEFERRED_TO_CLIENT]");
}
