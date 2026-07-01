import "server-only";

import { FREE_PREVIEW_POSTER_IMAGE_KEY } from "@/lib/image-config";
import { getImageForPage, isIllustrationReady, type BookImagesInput } from "@/lib/book-images";
import { STALE_IMAGE_GENERATING_MS } from "@/lib/server/generation-timeouts";
import type { BookPageImage, StoredBook } from "@/lib/types";

export const IMAGE_GENERATION_STALE_AFTER_MS = STALE_IMAGE_GENERATING_MS;

const TIMESTAMP_FIELDS = ["updatedAt", "startedAt", "generationStartedAt", "generatedAt"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTimestampFromRecord(record: Record<string, unknown> | null | undefined) {
  if (!record) {
    return null;
  }

  for (const field of TIMESTAMP_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getImageGenerationTimestamp(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
) {
  const raw = storedBook.images[String(pageNumber)];
  const rawTimestamp = isRecord(raw) ? readTimestampFromRecord(raw) : null;
  if (rawTimestamp) {
    return rawTimestamp;
  }

  const image = getImageForPage(
    input ?? {
      images: storedBook.images,
      imageStatus: storedBook.image_status,
    },
    pageNumber,
  );

  return readTimestampFromRecord(image as Record<string, unknown> | null | undefined);
}

export function getImageGeneratingAgeMs(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
) {
  const timestamp = getImageGenerationTimestamp(storedBook, pageNumber, input);
  if (!timestamp) {
    return null;
  }

  const updatedTime = new Date(timestamp).getTime();
  if (Number.isNaN(updatedTime)) {
    return null;
  }

  return Date.now() - updatedTime;
}

export function getPageGenerationStatus(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
) {
  const bookInput =
    input ??
    ({
      images: storedBook.images,
      imageStatus: storedBook.image_status,
    } satisfies BookImagesInput);
  const image = getImageForPage(bookInput, pageNumber);
  const status = image?.status ?? storedBook.image_status[String(pageNumber)] ?? "not_started";
  const timestamp = getImageGenerationTimestamp(storedBook, pageNumber, bookInput);
  const ageMs = getImageGeneratingAgeMs(storedBook, pageNumber, bookInput);

  return {
    status,
    startedAt: image?.startedAt ?? null,
    updatedAt: image?.updatedAt ?? null,
    generationStartedAt: image?.generationStartedAt ?? null,
    timestamp,
    ageMs,
    isReady: isIllustrationReady(image),
  };
}

export function getImageGenerationClaimId(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
) {
  const key = String(pageNumber);
  const raw = storedBook.images[key];
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const rawClaimId = (raw as { generationClaimId?: unknown }).generationClaimId;
    if (typeof rawClaimId === "string" && rawClaimId.trim()) {
      return rawClaimId.trim();
    }
  }

  const image = getImageForPage(
    input ?? {
      images: storedBook.images,
      imageStatus: storedBook.image_status,
    },
    pageNumber,
  );

  return typeof image?.generationClaimId === "string" && image.generationClaimId.trim()
    ? image.generationClaimId
    : null;
}

export function verifyImageGenerationClaimOwnership(
  storedBook: StoredBook,
  pageNumber: number,
  claimId: string,
  input?: BookImagesInput,
) {
  const state = getPageGenerationStatus(storedBook, pageNumber, input);
  const currentClaimId = getImageGenerationClaimId(storedBook, pageNumber, input);
  return state.status === "generating" && currentClaimId === claimId;
}

export function isImageGeneratingStale(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
  staleAfterMs = IMAGE_GENERATION_STALE_AFTER_MS,
) {
  const state = getPageGenerationStatus(storedBook, pageNumber, input);
  if (state.isReady || state.status !== "generating") {
    return false;
  }

  if (!state.timestamp || state.ageMs === null) {
    return false;
  }

  return state.ageMs >= staleAfterMs;
}

export function isImageFreshlyGenerating(
  storedBook: StoredBook,
  pageNumber: number,
  input?: BookImagesInput,
  staleAfterMs = IMAGE_GENERATION_STALE_AFTER_MS,
) {
  const state = getPageGenerationStatus(storedBook, pageNumber, input);
  if (state.isReady || state.status !== "generating") {
    return false;
  }

  if (!state.timestamp || state.ageMs === null) {
    return true;
  }

  return state.ageMs < staleAfterMs;
}

function readPreviewCoverImage(storedBook: StoredBook): BookPageImage | null {
  const raw = storedBook.images[FREE_PREVIEW_POSTER_IMAGE_KEY];
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    return {
      status: "ready",
      url: trimmed,
      storagePath: null,
      generatedAt: null,
    } as BookPageImage;
  }

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as BookPageImage;
  }

  return null;
}

export function getPreviewCoverGenerationStatus(storedBook: StoredBook) {
  const image = readPreviewCoverImage(storedBook);
  const status = image?.status ?? storedBook.image_status[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? "not_started";
  const timestamp = readTimestampFromRecord(image as Record<string, unknown> | null | undefined);
  const ageMs = timestamp ? Date.now() - new Date(timestamp).getTime() : null;

  return {
    status,
    startedAt: image?.startedAt ?? null,
    updatedAt: image?.updatedAt ?? null,
    generationStartedAt: image?.generationStartedAt ?? null,
    timestamp,
    ageMs: ageMs !== null && !Number.isNaN(ageMs) ? ageMs : null,
    isReady: isIllustrationReady(image),
  };
}

export function getPreviewCoverClaimId(storedBook: StoredBook) {
  const image = readPreviewCoverImage(storedBook);
  return typeof image?.generationClaimId === "string" && image.generationClaimId.trim()
    ? image.generationClaimId.trim()
    : null;
}

export function verifyPreviewCoverClaimOwnership(storedBook: StoredBook, claimId: string) {
  const state = getPreviewCoverGenerationStatus(storedBook);
  const currentClaimId = getPreviewCoverClaimId(storedBook);
  return state.status === "generating" && currentClaimId === claimId;
}

export function isPreviewCoverGeneratingStale(
  storedBook: StoredBook,
  staleAfterMs = IMAGE_GENERATION_STALE_AFTER_MS,
) {
  const state = getPreviewCoverGenerationStatus(storedBook);
  if (state.isReady || state.status !== "generating") {
    return false;
  }

  if (!state.timestamp || state.ageMs === null) {
    return false;
  }

  return state.ageMs >= staleAfterMs;
}

export function isPreviewCoverFreshlyGenerating(
  storedBook: StoredBook,
  staleAfterMs = IMAGE_GENERATION_STALE_AFTER_MS,
) {
  const state = getPreviewCoverGenerationStatus(storedBook);
  if (state.isReady || state.status !== "generating") {
    return false;
  }

  if (!state.timestamp || state.ageMs === null) {
    return true;
  }

  return state.ageMs < staleAfterMs;
}
