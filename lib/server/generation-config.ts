import "server-only";

const ALLOWED_IMAGE_QUALITIES = ["medium", "high", "auto"] as const;

export type ImageQuality = (typeof ALLOWED_IMAGE_QUALITIES)[number];

export function normalizeImageQuality(value: string | undefined): ImageQuality {
  if (!value || value === "low") {
    return "medium";
  }

  if ((ALLOWED_IMAGE_QUALITIES as readonly string[]).includes(value)) {
    return value as ImageQuality;
  }

  throw new Error(`Invalid OPENAI_IMAGE_QUALITY: ${value}`);
}

function readImageQualityEnv() {
  return process.env.OPENAI_IMAGE_QUALITY?.trim() || process.env.IMAGE_QUALITY?.trim();
}

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
export const IMAGE_QUALITY = normalizeImageQuality(readImageQualityEnv());
export const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1536";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini";
export const SYNOPSIS_MODEL =
  process.env.OPENAI_SYNOPSIS_MODEL?.trim() || process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini";
