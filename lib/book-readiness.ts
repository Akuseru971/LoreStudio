import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { areAllIllustrationsReady } from "@/lib/book-image-utils";
import type { BookStatus, StoredBook } from "@/lib/types";

const PAID_OR_PREPARING_STATUSES: BookStatus[] = ["paid", "preparing_assets", "generating", "ready"];

export function isPaidOrPreparingBook(status: BookStatus) {
  return PAID_OR_PREPARING_STATUSES.includes(status);
}

export function isBookFullyReady(book: StoredBook) {
  if (!isPaidOrPreparingBook(book.status)) {
    return false;
  }

  if (!book.access_token) {
    return false;
  }

  const sourceBook = book.full_book || book.free_book;
  if (!sourceBook?.pages || sourceBook.pages.length !== FULL_BOOK_PAGE_COUNT) {
    return false;
  }

  return areAllIllustrationsReady({
    images: book.images,
    imageStatus: book.image_status,
    pages: sourceBook.pages,
  });
}
