import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { PREMIUM_IMAGE_PAGE_NUMBERS } from "@/lib/image-config";
import type { ImagePageStatus, PageImageState, StoredBook } from "@/lib/types";
import { getImageForPage, getImageUrl, isIllustrationReady, normalizeBookImages } from "@/lib/book-images";

export function createDefaultImageStatusMap(): Record<string, ImagePageStatus> {
  return Object.fromEntries(
    Array.from({ length: FULL_BOOK_PAGE_COUNT }, (_, index) => [String(index + 1), "not_started" as ImagePageStatus]),
  );
}

export function resolvePageImageStatus(book: StoredBook, pageNumber: number) {
  const image = getImageForPage(
    {
      images: book.images,
      imageStatus: book.image_status,
    },
    pageNumber,
  );

  if (isIllustrationReady(image)) {
    return "ready" as ImagePageStatus;
  }

  return image?.status || "not_started";
}

export function buildPageImageStates(book: StoredBook): Record<string, PageImageState> {
  return normalizeBookImages({
    images: book.images,
    imageStatus: book.image_status,
  });
}

export function allPremiumImagesReady(book: StoredBook) {
  for (const pageNumber of PREMIUM_IMAGE_PAGE_NUMBERS) {
    const image = getImageForPage({ images: book.images, imageStatus: book.image_status }, pageNumber);
    if (!isIllustrationReady(image)) {
      return false;
    }
  }

  return true;
}

export function allBookImagesReady(book: StoredBook) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage({ images: book.images, imageStatus: book.image_status }, pageNumber);
    if (!isIllustrationReady(image)) {
      return false;
    }
  }

  return true;
}

export function areBookImagesPending(book: StoredBook) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage({ images: book.images, imageStatus: book.image_status }, pageNumber);
    if (image?.status === "generating" && !getImageUrl(image)) {
      return true;
    }

    if (!isIllustrationReady(image)) {
      return true;
    }
  }

  return false;
}
