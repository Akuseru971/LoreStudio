import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  markPageImageFailed,
  saveBookAsset,
} from "@/lib/bookStore";
import { generateBookPageImage } from "@/lib/images";
import type { LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

const FREE_IMAGE_PAGES = Array.from({ length: FREE_IMAGE_PAGE_COUNT }, (_, index) => index + 1);

async function generateAndStoreImageForPage({
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
    const imageUrl = await generateBookPageImage(normalizedBook, page, {
      fallbackOnFailure: false,
      maxAttempts: 2,
    });

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

export async function generateFreeBookImages(accessToken: string, book: LoreBook): Promise<StoredBook> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const results = await Promise.allSettled(
    FREE_IMAGE_PAGES.map((pageNumber) =>
      generateAndStoreImageForPage({
        accessToken,
        bookId: storedBook.id,
        book,
        pageNumber,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("[IMAGE_GENERATION_ERROR]", {
        pageNumber: FREE_IMAGE_PAGES[index],
        message: result.reason instanceof Error ? result.reason.message : "Image generation failed.",
      });
    }
  });

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found after image generation.");
  }

  return finalBook;
}
