import "server-only";

type SafeFetchMeta = Record<string, unknown>;

export async function safeFetch(url: string, options: RequestInit = {}, meta: SafeFetchMeta = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.SERVER_FETCH_TIMEOUT_MS || 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        "User-Agent": "LoreStudio/1.0",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Fetch failed with status ${response.status}: ${text.slice(0, 500)}`);
    }

    return response;
  } catch (error) {
    const routeError = error as { message?: string; name?: string; code?: string; cause?: unknown };
    console.error("[SAFE_FETCH_FAILED]", {
      urlPreview: String(url).slice(0, 160),
      meta,
      message: routeError.message,
      name: routeError.name,
      code: routeError.code,
      cause: routeError.cause,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
