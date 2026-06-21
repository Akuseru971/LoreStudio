import { validateApprovedSynopsis } from "@/lib/synopsisGeneration";
import type { ApprovedSynopsis, BookFormInput, LoreBook, StoredBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

type ApprovedSynopsisSource = {
  approved_synopsis?: ApprovedSynopsis | null;
  form_input?: (BookFormInput & {
    approvedSynopsis?: unknown;
    approved_synopsis?: unknown;
  }) | null;
};

function isApprovedSynopsis(value: unknown): value is ApprovedSynopsis {
  return validateApprovedSynopsis(value) !== null;
}

export function resolveApprovedSynopsis(source: ApprovedSynopsisSource | null | undefined): ApprovedSynopsis | null {
  if (!source) {
    return null;
  }

  if (isApprovedSynopsis(source.approved_synopsis)) {
    return source.approved_synopsis;
  }

  const formInput = source.form_input;
  if (!formInput || typeof formInput !== "object") {
    return null;
  }

  const legacy = formInput.approvedSynopsis ?? formInput.approved_synopsis;
  return validateApprovedSynopsis(legacy);
}

export function normalizeBookImages(book: LoreBook | null | undefined) {
  if (!book || !Array.isArray(book.pages)) {
    return {};
  }

  return Object.fromEntries(
    book.pages
      .filter((page) => Boolean(page?.imageUrl))
      .map((page) => [String(page.pageNumber), page.imageUrl as string]),
  );
}

export function normalizeBook(raw: unknown): LoreBook | null {
  if (!raw || typeof raw !== "object") {
    console.warn("[NORMALIZE_BOOK] Received invalid book payload.", raw);
    return null;
  }

  try {
    return normalizeLoreBook(raw as Parameters<typeof normalizeLoreBook>[0]);
  } catch (error) {
    console.error("[NORMALIZE_BOOK] Failed to normalize book.", error, raw);
    return null;
  }
}

export function normalizeStoredBookForClient(storedBook: StoredBook) {
  return {
    ...storedBook,
    approved_synopsis: resolveApprovedSynopsis(storedBook),
    pdf_status: storedBook.pdf_status || "not_started",
    mp3_status: storedBook.mp3_status || "not_started",
    confirmation_email_status: storedBook.confirmation_email_status || "not_started",
    images: storedBook.images || {},
    image_status: storedBook.image_status || {},
    audio: storedBook.audio || {},
    free_book: storedBook.free_book ? normalizeBook(storedBook.free_book) : null,
    full_book: storedBook.full_book ? normalizeBook(storedBook.full_book) : null,
  };
}
