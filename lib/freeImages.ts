import "server-only";

import { FREE_IMAGE_PAGE_COUNT, FREE_IMAGE_PAGES } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markPageImageFailed,
  saveBookAsset,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, isIllustrationReady, type BookImagesInput } from "@/lib/book-images";
import { generateBookPageImage } from "@/lib/images";
import { IMAGE_GENERATION_TIMEOUT_MS, STALE_IMAGE_GENERATING_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

export { FREE_IMAGE_PAGES } from "@/lib/image-config";

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
}) {
  if (pageNumber > FREE_IMAGE_PAGE_COUNT) {
    if (pageNumber === 4) {
      console.warn("[BLOCKED_PAGE_4_FREE_GENERATION]");
    }
    return null;
  }

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
      `FREE_IMAGE_PAGE_${pageNumber}`,
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

  await generateAndStoreFreeImageForPage({
    accessToken,
    bookId: storedBook.id,
    book: sourceBook,
    pageNumber,
  });

  console.log("[FREE_IMAGE_GENERATION_DONE]", { accessToken, pageNumber, at: Date.now() });

  const refreshedBook = await getBookByAccessToken(accessToken);
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
    generated: true,
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
