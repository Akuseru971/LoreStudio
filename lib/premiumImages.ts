import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markBookReady,
  markPageImageFailed,
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

export function findNextMissingPremiumImagePage(storedBook: StoredBook) {
  const input = getPremiumImagePagesInput(storedBook);

  for (const pageNumber of PREMIUM_IMAGE_PAGES) {
    const image = getImageForPage(input, pageNumber);
    if (isIllustrationReady(image)) {
      console.log("[GENERATE_NEXT_PREMIUM_IMAGE_SKIP_READY]", pageNumber);
      continue;
    }

    if (image?.status === "generating") {
      const updatedAt = new Date(storedBook.updated_at).getTime();
      const isStale = !Number.isNaN(updatedAt) && Date.now() - updatedAt >= STALE_IMAGE_GENERATING_MS;
      if (!isStale) {
        continue;
      }
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

  const sourceBook = storedBook.full_book || storedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  if (arePremiumIllustrationsReady(storedBook) && allBookImagesReady(storedBook)) {
    const readyBook = await markPremiumAssetsReadyIfComplete(storedBook);
    return {
      storedBook: readyBook || storedBook,
      pageNumber: null,
      generated: false,
      done: true,
      allPremiumImagesReady: true,
      allIllustrationsReady: true,
      readyPremiumImageCount: PREMIUM_IMAGE_PAGES.length,
      readyIllustrationCount: FULL_BOOK_PAGE_COUNT,
      missingPremiumPages: [] as number[],
    };
  }

  const pageNumber = findNextMissingPremiumImagePage(storedBook);
  if (!pageNumber) {
    const refreshedBook = await getBookByAccessToken(accessToken);
    if (!refreshedBook) {
      throw new Error("Book not found.");
    }

    const allPremiumImagesReady = arePremiumIllustrationsReady(refreshedBook);
    const allIllustrationsReady = allBookImagesReady(refreshedBook);
    const readyBook =
      allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

    return {
      storedBook: readyBook || refreshedBook,
      pageNumber: null,
      generated: false,
      done: true,
      allPremiumImagesReady,
      allIllustrationsReady,
      readyPremiumImageCount: countReadyPremiumImages(refreshedBook),
      readyIllustrationCount: getReadyIllustrationCount({
        images: refreshedBook.images,
        imageStatus: refreshedBook.image_status,
        pages: (refreshedBook.full_book || refreshedBook.free_book)?.pages,
      }),
      missingPremiumPages: getMissingPremiumImagePages(refreshedBook),
    };
  }

  console.log("[GENERATE_NEXT_PREMIUM_IMAGE_SELECTED_PAGE]", pageNumber);
  await updateGenerationProgress(storedBook.id, "preparing", { generationError: null });

  await generateAndStorePremiumImageForPage({
    accessToken,
    bookId: storedBook.id,
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
  const readyBook =
    allIllustrationsReady ? await markPremiumAssetsReadyIfComplete(refreshedBook) : refreshedBook;

  return {
    storedBook: readyBook || refreshedBook,
    pageNumber,
    generated: true,
    done: allPremiumImagesReady || findNextMissingPremiumImagePage(refreshedBook) === null,
    allPremiumImagesReady,
    allIllustrationsReady,
    readyPremiumImageCount: countReadyPremiumImages(refreshedBook),
    readyIllustrationCount: getReadyIllustrationCount({
      images: refreshedBook.images,
      imageStatus: refreshedBook.image_status,
      pages: (refreshedBook.full_book || refreshedBook.free_book)?.pages,
    }),
    missingPremiumPages,
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

  let latestResult = await generateNextPremiumImage(accessToken);

  while (!latestResult.allPremiumImagesReady && latestResult.pageNumber !== null) {
    latestResult = await generateNextPremiumImage(accessToken);
  }

  const finalBook = latestResult.storedBook;
  console.log("[IMAGE_READY_COUNT]", buildPageImageStates(finalBook));

  return {
    book: finalBook,
    images: buildPageImageStates(finalBook),
    allReady: latestResult.allIllustrationsReady,
  };
}

export async function ensureAllBookImagesReady(accessToken: string, maxWaitMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const result = await generateNextPremiumImage(accessToken);
    if (result.allIllustrationsReady) {
      const sourceBook = result.storedBook.full_book || result.storedBook.free_book;
      if (!sourceBook) {
        throw new Error("Book content is missing.");
      }

      const { mergeBookAssets } = await import("@/lib/bookStore");
      const mergedBook = await mergeBookAssets(sourceBook, result.storedBook.images, result.storedBook.audio);
      return { book: mergedBook, storedBook: result.storedBook };
    }

    if (result.done && !result.generated) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Illustrations are still being prepared. Please try again shortly.");
}

export function triggerPremiumImageGeneration(accessToken: string) {
  void generateNextPremiumImage(accessToken).catch((error) => {
    console.error("Background premium image generation failed.", error);
  });
}
