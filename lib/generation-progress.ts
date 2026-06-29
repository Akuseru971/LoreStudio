import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";

export type GenerationProgressStatus =
  | "not_started"
  | "generating_text"
  | "generating_images"
  | "preparing"
  | "ready_free"
  | "failed";

export const GENERATION_MAX_WAIT_MS = 10 * 60 * 1000;
export const GENERATION_POLL_MS = 4000;
export const STALE_GENERATION_MS = 2 * 60 * 1000;
export const GENERATE_BOOK_FETCH_MS = 150 * 1000;

export const GENERATION_PROGRESS_MESSAGES = {
  writing: "Writing your illustrated chronicle...",
  illustrations: "Preparing the first illustrations...",
  firstVisionReady: "Your first vision is ready.\nFinalizing your preview...",
  longWait90: "Your chronicle is still being written. Some legends take a little longer.",
  longWait180: "The first illustrations are still being prepared. You can keep this page open.",
  almostReady: "Your book is almost ready.",
  stillWorking: "Still working. This can take a little longer than usual.",
} as const;

export function isGenerationPreparing(status: GenerationProgressStatus | string | null | undefined) {
  return (
    status === "generating_text" ||
    status === "generating_images" ||
    status === "preparing" ||
    status === "generating"
  );
}

export function getClientProgressMessage({
  elapsedMs,
  hasText,
  readyFreeImageCount,
  freeImagesTotal = FREE_IMAGE_PAGE_COUNT,
}: {
  elapsedMs: number;
  hasText: boolean;
  readyFreeImageCount: number;
  freeImagesTotal?: number;
}) {
  if (readyFreeImageCount >= freeImagesTotal && hasText) {
    return GENERATION_PROGRESS_MESSAGES.almostReady;
  }

  if (hasText && readyFreeImageCount >= 1 && readyFreeImageCount < freeImagesTotal) {
    return GENERATION_PROGRESS_MESSAGES.firstVisionReady;
  }

  if (elapsedMs >= 180_000) {
    return GENERATION_PROGRESS_MESSAGES.longWait180;
  }

  if (elapsedMs >= 90_000) {
    return hasText ? GENERATION_PROGRESS_MESSAGES.longWait90 : GENERATION_PROGRESS_MESSAGES.stillWorking;
  }

  if (hasText && readyFreeImageCount < freeImagesTotal) {
    return GENERATION_PROGRESS_MESSAGES.illustrations;
  }

  return GENERATION_PROGRESS_MESSAGES.writing;
}

export function isGenerationStale(updatedAt: string | null | undefined, staleAfterMs = STALE_GENERATION_MS) {
  if (!updatedAt) {
    return false;
  }

  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) {
    return false;
  }

  return Date.now() - updatedTime >= staleAfterMs;
}
