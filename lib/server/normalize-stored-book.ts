import "server-only";

import { resolveApprovedSynopsis } from "@/lib/synopsisValidation";
import type { StoredBook } from "@/lib/types";
import { normalizeBook } from "@/lib/normalizeBook";

export { resolveApprovedSynopsis } from "@/lib/synopsisValidation";

export function normalizeStoredBookForClient(storedBook: StoredBook) {
  return {
    ...storedBook,
    approved_synopsis: resolveApprovedSynopsis(storedBook),
    pdf_status: storedBook.pdf_status || "not_started",
    mp3_status: storedBook.mp3_status || "not_started",
    confirmation_email_status: storedBook.confirmation_email_status || "not_started",
    assets_ready_at: storedBook.assets_ready_at || null,
    images: storedBook.images || {},
    image_status: storedBook.image_status || {},
    audio: storedBook.audio || {},
    free_book: storedBook.free_book ? normalizeBook(storedBook.free_book) : null,
    full_book: storedBook.full_book ? normalizeBook(storedBook.full_book) : null,
  };
}
