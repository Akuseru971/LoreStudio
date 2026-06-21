import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
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
  void generatePremiumImages(accessToken).catch((error) => {
    console.error("Background premium image generation failed.", error);
  });
}
