import "server-only";

export const TEXT_GENERATION_TIMEOUT_MS = 120_000;
export const IMAGE_GENERATION_TIMEOUT_MS = 180_000;
export const STALE_IMAGE_GENERATING_MS = 2 * 60 * 1000;
export const MAX_TEXT_REPAIR_ATTEMPTS = 2;

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
