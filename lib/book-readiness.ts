import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import type { ConfirmationEmailStatus, StoredBook } from "@/lib/types";

export type BookReadinessSummary = {
  status: StoredBook["status"];
  isPaid: boolean;
  readyImagesCount: number;
  totalImages: number;
  missingPremiumPages: number[];
  failedPages: number[];
  isReady: boolean;
  emailStatus: ConfirmationEmailStatus;
};

export function isBookFullyReady(storedBook: StoredBook) {
  if (!hasPremiumAccess(storedBook.status) && storedBook.status !== "ready") {
    return false;
  }

  const normalized = getNormalizedImagesForStoredBook(storedBook);
  return normalized.allIllustrationsReady;
}

export function getBookReadinessSummary(storedBook: StoredBook): BookReadinessSummary {
  const normalized = getNormalizedImagesForStoredBook(storedBook);
  const missingPremiumPages = PREMIUM_IMAGE_PAGE_NUMBERS.filter((pageNumber) =>
    normalized.missingPages.includes(pageNumber),
  );
  const failedPages = PREMIUM_IMAGE_PAGE_NUMBERS.filter((pageNumber) => {
    const image = normalized.images[String(pageNumber)];
    return image?.status === "failed";
  });

  return {
    status: storedBook.status,
    isPaid: hasPremiumAccess(storedBook.status),
    readyImagesCount: normalized.readyIllustrationCount,
    totalImages: FULL_BOOK_PAGE_COUNT,
    missingPremiumPages,
    failedPages,
    isReady: storedBook.status === "ready" || normalized.allIllustrationsReady,
    emailStatus: storedBook.confirmation_email_status,
  };
}
