import "server-only";

const DEFAULT_IMAGE_QUALITY = "medium" as const;

const ALLOWED_IMAGE_QUALITIES = ["medium", "high", "auto"] as const;

export type ImageQuality = (typeof ALLOWED_IMAGE_QUALITIES)[number];

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function normalizeImageQuality(value: string | undefined): ImageQuality {
  if (!value || value === "low") {
    return DEFAULT_IMAGE_QUALITY;
  }

  if ((ALLOWED_IMAGE_QUALITIES as readonly string[]).includes(value)) {
    return value as ImageQuality;
  }

  throw new Error(`Invalid OPENAI_IMAGE_QUALITY: ${value}`);
}

export const TEXT_MODEL = readEnv("OPENAI_TEXT_MODEL", "OPENAI_FAST_TEXT_MODEL") || "gpt-4.1-mini";

export const SYNOPSIS_TEXT_MODEL =
  readEnv("OPENAI_SYNOPSIS_TEXT_MODEL", "OPENAI_SYNOPSIS_MODEL") || TEXT_MODEL;

export const BOOK_TEXT_MODEL = readEnv("OPENAI_BOOK_TEXT_MODEL") || TEXT_MODEL;

export const IMAGE_MODEL = readEnv("OPENAI_IMAGE_MODEL") || "gpt-image-2";

export const IMAGE_QUALITY = normalizeImageQuality(readEnv("OPENAI_IMAGE_QUALITY", "IMAGE_QUALITY"));

export const IMAGE_SIZE = readEnv("OPENAI_IMAGE_SIZE") || "1024x1536";

/** @deprecated Use SYNOPSIS_TEXT_MODEL */
export const SYNOPSIS_MODEL = SYNOPSIS_TEXT_MODEL;
