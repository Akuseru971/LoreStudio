import "server-only";

type RetryMeta = Record<string, unknown>;

const RETRY_DELAYS_MS = [0, 1500, 4000];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isRetryableImageError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error);

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (code === "unknown_parameter") {
    return false;
  }

  if (code === "UND_ERR_SOCKET" || code === "ECONNRESET" || code === "ETIMEDOUT") {
    return true;
  }

  if (message.includes("fetch failed")) {
    return true;
  }

  if (/\b429\b/.test(message) || /\b50[0234]\b/.test(message)) {
    return true;
  }

  if (
    message.includes("unauthorized") ||
    message.includes("invalid_api_key") ||
    message.includes("missing openai_api_key") ||
    message.includes("invalid prompt") ||
    message.includes("unsupported") ||
    message.includes("unknown parameter") ||
    message.includes("bad request")
  ) {
    return false;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  meta: RetryMeta = {},
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 1) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableImageError(error) || attempt >= maxRetries) {
        throw error;
      }

      console.warn("[IMAGE_RETRY]", {
        ...meta,
        attempt,
        reason: getErrorMessage(error),
      });
    }
  }

  throw lastError;
}

export function logImageGenerationStepError(
  pageNumber: number,
  step: string,
  error: unknown,
) {
  const routeError = error as {
    message?: string;
    name?: string;
    code?: string;
    cause?: unknown;
    stack?: string;
  };

  console.error("[IMAGE_GENERATION_STEP_ERROR]", {
    pageNumber,
    step,
    message: routeError.message,
    name: routeError.name,
    code: routeError.code,
    cause: routeError.cause,
    stack: routeError.stack,
  });
}
