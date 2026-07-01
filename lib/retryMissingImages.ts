import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
import { getBookByAccessToken } from "@/lib/bookStore";
import {
  areAllIllustrationsReady,
  getImageForPage,
  getMissingIllustrationPages,
  getReadyIllustrationCount,
  isIllustrationReady,
  normalizeBookImages,
} from "@/lib/book-images";
import { generateNextPremiumImage } from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { generateAndStoreFreeImageForPage, generateAndStoreFreePreviewCover, isFreePage1Ready, isPreviewPosterReady } from "@/lib/freeImages";

export async function retryMissingImages(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const isPremium = hasPremiumAccess(storedBook.status);
  const maxPage = isPremium ? FULL_BOOK_PAGE_COUNT : FREE_IMAGE_PAGE_COUNT;
  const sourceBook = storedBook.full_book || storedBook.free_book;

  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  const imagesInput = {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages: sourceBook.pages,
  };

  const missingBefore = isPremium
    ? getMissingIllustrationPages(imagesInput).filter((pageNumber) => pageNumber <= maxPage)
    : getMissingIllustrationPages(imagesInput).filter((pageNumber) => pageNumber <= 2);

  if (isPremium) {
    for (const pageNumber of missingBefore) {
      const image = getImageForPage(imagesInput, pageNumber);
      if (isIllustrationReady(image)) {
        continue;
      }

      const result = await generateNextPremiumImage(accessToken);
      if (result.allIllustrationsReady) {
        break;
      }

      if (result.pageNumber === pageNumber && !result.generated) {
        continue;
      }
    }
  } else {
    const freeMissingStoryPages = missingBefore.filter((pageNumber) => pageNumber <= 2);

    if (freeMissingStoryPages.includes(1)) {
      const image = getImageForPage(imagesInput, 1);
      if (!isIllustrationReady(image)) {
        await generateAndStoreFreeImageForPage({
          accessToken,
          bookId: storedBook.id,
          book: sourceBook,
          pageNumber: 1,
        });
      }
    }

    const refreshedBook = await getBookByAccessToken(accessToken);
    if (!refreshedBook) {
      throw new Error("Book not found.");
    }

    const refreshedSource = refreshedBook.free_book;
    if (!refreshedSource) {
      throw new Error("Book content is missing.");
    }

    const refreshedInput = {
      images: refreshedBook.images,
      imageStatus: refreshedBook.image_status,
      pages: refreshedSource.pages,
    };

    if (isFreePage1Ready(refreshedBook)) {
      const parallelTasks: Array<Promise<unknown>> = [];

      if (!isIllustrationReady(getImageForPage(refreshedInput, 2))) {
        parallelTasks.push(
          generateAndStoreFreeImageForPage({
            accessToken,
            bookId: refreshedBook.id,
            book: refreshedSource,
            pageNumber: 2,
          }),
        );
      }

      if (!isPreviewPosterReady(refreshedBook)) {
        parallelTasks.push(
          generateAndStoreFreePreviewCover({
            accessToken,
            bookId: refreshedBook.id,
            book: refreshedSource,
          }),
        );
      }

      if (parallelTasks.length > 0) {
        await Promise.allSettled(parallelTasks);
      }
    }
  }

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found.");
  }

  const finalSource = finalBook.full_book || finalBook.free_book;
  const finalInput = {
    images: finalBook.images,
    imageStatus: finalBook.image_status,
    pages: finalSource?.pages,
  };

  return {
    images: normalizeBookImages(finalInput),
    readyIllustrationCount: getReadyIllustrationCount(finalInput),
    allReady: areAllIllustrationsReady(finalInput),
    missingPages: getMissingIllustrationPages(finalInput),
  };
}
