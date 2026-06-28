import "server-only";

import { FREE_IMAGE_PAGE_COUNT, FREE_IMAGE_PAGES } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  getBookById,
  markPageImageFailed,
  saveBookAsset,
  stampMissingGeneratingTimestamp,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, isIllustrationReady, type BookImagesInput } from "@/lib/book-images";
import {
  getPageGenerationStatus,
  isImageFreshlyGenerating,
  verifyImageGenerationClaimOwnership,
} from "@/lib/imageGenerationTimestamps";
import { generateBookPageImage } from "@/lib/images";
import { IMAGE_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

export { FREE_IMAGE_PAGES } from "@/lib/image-config";

export type GenerateStoredFreeImageResult = {
  book: StoredBook | null;
  generated: boolean;
  claimLost: boolean;
};

export function getFreeImagePagesInput(storedBook: StoredBook): BookImagesInput {
  return {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages: storedBook.free_book?.pages,
  };
}

export function countReadyFreeImages(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  return FREE_IMAGE_PAGES.filter((pageNumber) => isIllustrationReady(getImageForPage(input, pageNumber))).length;
}

export function getMissingFreeImagePages(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  return FREE_IMAGE_PAGES.filter((pageNumber) => !isIllustrationReady(getImageForPage(input, pageNumber)));
}

export function areFreeIllustrationsReady(storedBook: StoredBook) {
  return getMissingFreeImagePages(storedBook).length === 0;
}

export function findNextMissingFreeImagePage(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);

  for (const pageNumber of FREE_IMAGE_PAGES) {
    const image = getImageForPage(input, pageNumber);
    if (isIllustrationReady(image)) {
      continue;
    }

    if (image?.status === "generating" && isImageFreshlyGenerating(storedBook, pageNumber, input)) {
      continue;
    }

    return pageNumber;
  }

  return null;
}

export async function generateAndStoreFreeImageForPage({
  accessToken,
  bookId,
  book,
  pageNumber,
}: {
  accessToken: string;
  bookId: string;
  book: LoreBook;
  pageNumber: number;
}): Promise<GenerateStoredFreeImageResult> {
  if (pageNumber > FREE_IMAGE_PAGE_COUNT) {
    if (pageNumber === 4) {
      console.warn("[BLOCKED_PAGE_4_FREE_GENERATION]");
    }
    return { book: null, generated: false, claimLost: false };
  }

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
    return {
      book: refreshedBook || (await getBookByAccessToken(accessToken)),
      generated: false,
      claimLost: true,
    };
  }

  const { claimId } = claim;
  let latestBook = (await getBookById(bookId)) || claim.book;

  if (!verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
    return { book: latestBook, generated: false, claimLost: true };
  }

  const verifyState = getPageGenerationStatus(latestBook, pageNumber);
  if (verifyState.isReady) {
    return { book: latestBook, generated: false, claimLost: false };
  }

  if (!verifyState.timestamp) {
    const stampedBook = await stampMissingGeneratingTimestamp(bookId, pageNumber);
    latestBook = stampedBook || latestBook;
    if (!verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
      return { book: latestBook, generated: false, claimLost: true };
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
    return { book: latestBook, generated: false, claimLost: false };
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
      `FREE_IMAGE_PAGE_${pageNumber}`,
    );

    if (!imageUrl) {
      await markPageImageFailed(bookId, pageNumber, claimId);
      console.error("[IMAGE_GENERATION_ERROR]", {
        pageNumber,
        message: "No image URL returned.",
      });
      return { book: latestBook, generated: false, claimLost: false };
    }

    const savedBook = await saveBookAsset(accessToken, pageNumber, "image", imageUrl, { claimId });
    return { book: savedBook, generated: true, claimLost: false };
  } catch (error) {
    await markPageImageFailed(bookId, pageNumber, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: error instanceof Error ? error.message : "Image generation failed.",
    });
    return { book: latestBook, generated: false, claimLost: false };
  }
}

export async function generateNextFreeImage(accessToken: string) {
  console.log("[FREE_IMAGE_GENERATION_PAGES]", [...FREE_IMAGE_PAGES]);

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const sourceBook = storedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  if (areFreeIllustrationsReady(storedBook)) {
    return {
      storedBook,
      pageNumber: null,
      generated: false,
      done: true,
      allFreeImagesReady: true,
      readyFreeImageCount: FREE_IMAGE_PAGE_COUNT,
      missingFreePages: [] as number[],
    };
  }

  const pageNumber = findNextMissingFreeImagePage(storedBook);
  if (!pageNumber) {
    const refreshedBook = await getBookByAccessToken(accessToken);
    if (!refreshedBook) {
      throw new Error("Book not found.");
    }

    return {
      storedBook: refreshedBook,
      pageNumber: null,
      generated: false,
      done: true,
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  console.log("[FREE_IMAGE_GENERATION_START]", { accessToken, pageNumber, at: Date.now() });

  const generationResult = await generateAndStoreFreeImageForPage({
    accessToken,
    bookId: storedBook.id,
    book: sourceBook,
    pageNumber,
  });

  if (generationResult.claimLost) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || generationResult.book;
    return {
      storedBook: refreshedBook || storedBook,
      pageNumber,
      generated: false,
      done: false,
      retryable: true,
      reason: "claim_lost_to_another_request" as const,
      allFreeImagesReady: refreshedBook ? areFreeIllustrationsReady(refreshedBook) : false,
      readyFreeImageCount: refreshedBook ? countReadyFreeImages(refreshedBook) : countReadyFreeImages(storedBook),
      missingFreePages: refreshedBook ? getMissingFreeImagePages(refreshedBook) : getMissingFreeImagePages(storedBook),
    };
  }

  console.log("[FREE_IMAGE_GENERATION_DONE]", { accessToken, pageNumber, at: Date.now() });

  const refreshedBook = (await getBookByAccessToken(accessToken)) || generationResult.book;
  if (!refreshedBook) {
    throw new Error("Book not found after image generation.");
  }

  const missingFreePages = getMissingFreeImagePages(refreshedBook);
  const allFreeImagesReady = missingFreePages.length === 0;

  if (allFreeImagesReady) {
    await updateGenerationProgress(refreshedBook.id, "ready_free", { generationError: null });
  } else {
    await updateGenerationProgress(refreshedBook.id, "generating_images", { generationError: null });
  }

  return {
    storedBook: refreshedBook,
    pageNumber,
    generated: generationResult.generated,
    done: allFreeImagesReady || findNextMissingFreeImagePage(refreshedBook) === null,
    allFreeImagesReady,
    readyFreeImageCount: countReadyFreeImages(refreshedBook),
    missingFreePages,
  };
}

export async function generateFreeBookImages(accessToken: string, book: LoreBook): Promise<StoredBook> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  console.log("[FREE_IMAGES_PARALLEL_START]", Date.now());

  await Promise.allSettled(
    FREE_IMAGE_PAGES.map((pageNumber) =>
      generateAndStoreFreeImageForPage({
        accessToken,
        bookId: storedBook.id,
        book,
        pageNumber,
      }),
    ),
  );

  console.log("[FREE_IMAGES_PARALLEL_DONE]", Date.now());

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found after image generation.");
  }

  return finalBook;
}
