import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import type { ImagePageStatus, PageImageState, StoredBook } from "@/lib/types";

export function createDefaultImageStatusMap(): Record<string, ImagePageStatus> {
  return Object.fromEntries(
    Array.from({ length: FULL_BOOK_PAGE_COUNT }, (_, index) => [String(index + 1), "not_started" as ImagePageStatus]),
  );
}

export function resolvePageImageStatus(book: StoredBook, pageNumber: number): ImagePageStatus {
  const key = String(pageNumber);
  const storedStatus = book.image_status?.[key];
  if (storedStatus) {
    return storedStatus;
  }

  if (book.images[key]) {
    return "ready";
  }

  return "not_started";
}

export function buildPageImageStates(book: StoredBook): Record<string, PageImageState> {
  const states: Record<string, PageImageState> = {};

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const key = String(pageNumber);
    states[key] = {
      status: resolvePageImageStatus(book, pageNumber),
      url: book.images[key] || null,
    };
  }

  return states;
}

export function allPremiumImagesReady(book: StoredBook) {
  for (let pageNumber = 5; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    if (resolvePageImageStatus(book, pageNumber) !== "ready" || !book.images[String(pageNumber)]) {
      return false;
    }
  }

  return true;
}

export function allBookImagesReady(book: StoredBook) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    if (resolvePageImageStatus(book, pageNumber) !== "ready" || !book.images[String(pageNumber)]) {
      return false;
    }
  }

  return true;
}
