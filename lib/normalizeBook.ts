import { validateApprovedSynopsis } from "@/lib/synopsisValidation";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/lore-normalize";

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

export function isApprovedSynopsis(value: unknown): boolean {
  return validateApprovedSynopsis(value) !== null;
}
