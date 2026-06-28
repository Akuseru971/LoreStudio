import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  getBookById,
  markBookReady,
  markPageImageFailed,
  resetStalePageImageGeneration,
  saveBookAsset,
  stampMissingGeneratingTimestamp,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, getReadyIllustrationCount, isIllustrationReady, type BookImagesInput } from "@/lib/book-images";
import {
  getImageGenerationTimestamp,
  getPageGenerationStatus,
  isImageFreshlyGenerating,
  isImageGeneratingStale,
  verifyImageGenerationClaimOwnership,
} from "@/lib/imageGenerationTimestamps";
import { generateBookPageImage } from "@/lib/images";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { IMAGE_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";
import {
  allBookImagesReady,
  buildPageImageStates,
} from "@/lib/imageStatus";

export const PREMIUM_IMAGE_PAGES = [...PREMIUM_IMAGE_PAGE_NUMBERS];

const PAGE_ALREADY_GENERATING_RETRY_MS = 10_000;

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

export function isPremiumImageGeneratingStale(storedBook: StoredBook, pageNumber: number) {
  return isImageGeneratingStale(storedBook, pageNumber, getPremiumImagePagesInput(storedBook));
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
  let latestBook = storedBook;

  for (const pageNumber of PREMIUM_IMAGE_PAGES) {
    const input = getPremiumImagePagesInput(latestBook);
    const image = getImageForPage(input, pageNumber);
    if (image?.status !== "generating" || isIllustrationReady(image)) {
      continue;
    }

    const timestamp = getImageGenerationTimestamp(latestBook, pageNumber, input);
    if (!timestamp) {
      const stampedBook = await stampMissingGeneratingTimestamp(latestBook.id, pageNumber);
      if (stampedBook) {
        latestBook = stampedBook;
      }
      continue;
    }

    if (!isImageGeneratingStale(latestBook, pageNumber, input)) {
      continue;
    }

    console.log("[STALE_PREMIUM_IMAGE_DETECTED]", {
      bookId: latestBook.id,
      pageNumber,
      status: "generating",
      updatedAt: timestamp,
    });

    const resetBook = await resetStalePageImageGeneration(latestBook.id, pageNumber);
    if (resetBook) {
      latestBook = resetBook;
      console.log("[STALE_PREMIUM_IMAGE_RESET_FOR_RETRY]", {
        bookId: latestBook.id,
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

    if (image?.status === "generating" && isImageFreshlyGenerating(storedBook, pageNumber, input)) {
      continue;
    }

    return pageNumber;
  }

  return null;
}

function buildPremiumGenerationBaseResult(storedBook: StoredBook) {
  const status = getPremiumGenerationStatus(storedBook);
  return {
    storedBook,
    allPremiumImagesReady: status.missingPremiumPages.length === 0,
    allIllustrationsReady: allBookImagesReady(storedBook),
    readyPremiumImageCount: countReadyPremiumImages(storedBook),
    readyIllustrationCount: getReadyIllustrationCount({
      images: storedBook.images,
      imageStatus: storedBook.image_status,
      pages: (storedBook.full_book || storedBook.free_book)?.pages,
    }),
    missingPremiumPages: status.missingPremiumPages,
    stalePremiumPages: status.stalePremiumPages,
    shouldContinuePremiumGeneration: status.shouldContinuePremiumGeneration,
  };
}

function buildPageAlreadyGeneratingResult(storedBook: StoredBook, pageNumber: number | null) {
  return {
    ...buildPremiumGenerationBaseResult(storedBook),
    pageNumber,
    generated: false,
    done: false,
    retryable: true,
    reason: "page_already_generating" as const,
    retryAfterMs: PAGE_ALREADY_GENERATING_RETRY_MS,
  };
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
  const claim = await claimPageImageGeneration(bookId, pageNumber);
  if (!claim) {
    const refreshedBook = await getBookById(bookId);
    if (refreshedBook && isImageFreshlyGenerating(refreshedBook, pageNumber)) {
      const state = getPageGenerationStatus(refreshedBook, pageNumber);
      console.log("[IMAGE_GENERATION_SKIP_ALREADY_GENERATING]", {
        bookId,
        pageNumber,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
        ageMs: state.ageMs,
      });
    }
    return { skipped: true as const, claimLost: true as const, book: refreshedBook };
  }

  const { claimId } = claim;
  let latestBook = (await getBookById(bookId)) || claim.book;

  if (!verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
    return { skipped: true as const, claimLost: true as const, book: latestBook };
  }

  const verifyState = getPageGenerationStatus(latestBook, pageNumber);
  if (verifyState.isReady) {
    return { skipped: true as const, claimLost: false as const, book: latestBook };
  }

  if (!verifyState.timestamp) {
    const stampedBook = await stampMissingGeneratingTimestamp(bookId, pageNumber);
    latestBook = stampedBook || latestBook;
    if (!verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
      return { skipped: true as const, claimLost: true as const, book: latestBook };
    }
  }

  const normalizedBook = normalizeLoreBook(book);
  const page = normalizedBook.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    await markPageImageFailed(bookId, pageNumber, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: `Page ${pageNumber} is missing.`,
    });
    return { skipped: true as const, claimLost: false as const, book: latestBook };
  }

  try {
    console.log("[OPENAI_IMAGE_API_CALL_START]", {
      bookId,
      pageNumber,
      claimId,
    });

    const imageUrl = await withTimeout(
      generateBookPageImage(normalizedBook, page, {
        fallbackOnFailure: false,
        maxAttempts: 2,
      }),
      IMAGE_GENERATION_TIMEOUT_MS,
      `PREMIUM_IMAGE_PAGE_${pageNumber}`,
    );

    if (!imageUrl) {
      await markPageImageFailed(bookId, pageNumber, claimId);
      console.error("[IMAGE_GENERATION_ERROR]", {
        pageNumber,
        message: "No image URL returned.",
      });
      return { skipped: true as const, claimLost: false as const, book: latestBook };
    }

    const savedBook = await saveBookAsset(accessToken, pageNumber, "image", imageUrl, { claimId });
    return { skipped: false as const, claimLost: false as const, book: savedBook };
  } catch (error) {
    await markPageImageFailed(bookId, pageNumber, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: error instanceof Error ? error.message : "Image generation failed.",
    });
    return { skipped: true as const, claimLost: false as const, book: latestBook };
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
      ...buildPremiumGenerationBaseResult(readyBook || workingBook),
      pageNumber: null,
      generated: false,
      done: true,
    };
  }

  const pageNumber = findNextMissingPremiumImagePage(workingBook);
  if (!pageNumber) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || workingBook;
    const missingPremiumPages = getMissingPremiumImagePages(refreshedBook);
    const hasFreshGenerating = missingPremiumPages.some((missingPage) =>
      isImageFreshlyGenerating(refreshedBook, missingPage, getPremiumImagePagesInput(refreshedBook)),
    );

    if (hasFreshGenerating) {
      return buildPageAlreadyGeneratingResult(refreshedBook, null);
    }

    const allPremiumImagesReady = arePremiumIllustrationsReady(refreshedBook);
    const allIllustrationsReady = allBookImagesReady(refreshedBook);
    const readyBook =
      allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

    return {
      ...buildPremiumGenerationBaseResult(readyBook || refreshedBook),
      pageNumber: null,
      generated: false,
      done: allPremiumImagesReady,
    };
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_SELECTED_PAGE]", pageNumber);
  await updateGenerationProgress(workingBook.id, "preparing", { generationError: null });

  const generationResult = await generateAndStorePremiumImageForPage({
    accessToken,
    bookId: workingBook.id,
    book: sourceBook,
    pageNumber,
  });

  if (generationResult.skipped) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || generationResult.book || workingBook;
    if (generationResult.claimLost) {
      return {
        ...buildPremiumGenerationBaseResult(refreshedBook),
        pageNumber,
        generated: false,
        done: false,
        retryable: true,
        reason: "claim_lost_to_another_request" as const,
        retryAfterMs: PAGE_ALREADY_GENERATING_RETRY_MS,
      };
    }

    if (isImageFreshlyGenerating(refreshedBook, pageNumber, getPremiumImagePagesInput(refreshedBook))) {
      return buildPageAlreadyGeneratingResult(refreshedBook, pageNumber);
    }
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_DONE]", pageNumber);

  const refreshedBook = (await getBookByAccessToken(accessToken)) || generationResult.book || workingBook;
  if (!refreshedBook) {
    throw new Error("Book not found after image generation.");
  }

  const allPremiumImagesReady = getMissingPremiumImagePages(refreshedBook).length === 0;
  const allIllustrationsReady = allBookImagesReady(refreshedBook);
  const readyBook =
    allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

  return {
    ...buildPremiumGenerationBaseResult(readyBook || refreshedBook),
    pageNumber,
    generated: !generationResult.skipped,
    done: allPremiumImagesReady,
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
