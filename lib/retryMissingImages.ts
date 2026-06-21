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
import { generatePremiumImages } from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { generateAndStoreFreeImageForPage } from "@/lib/freeImages";

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

  const missingBefore = getMissingIllustrationPages(imagesInput).filter((pageNumber) => pageNumber <= maxPage);

  if (isPremium) {
    await generatePremiumImages(accessToken);
  } else {
    for (const pageNumber of missingBefore) {
      const image = getImageForPage(imagesInput, pageNumber);
      if (isIllustrationReady(image)) {
        continue;
      }

      await generateAndStoreFreeImageForPage({
        accessToken,
        bookId: storedBook.id,
        book: sourceBook,
        pageNumber,
      });
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
