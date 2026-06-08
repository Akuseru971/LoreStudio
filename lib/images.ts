import { buildFinalImagePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { BookPage, LoreBook } from "@/lib/types";
import { dataUrlFromBase64 } from "@/lib/utils";

type GenerateImageOptions = {
  fallbackOnFailure?: boolean;
  maxAttempts?: number;
};

export async function generateBookPageImage(book: LoreBook, page: BookPage, options: GenerateImageOptions = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return options.fallbackOnFailure ? buildFallbackIllustration(book, page) : undefined;
  }

  // gpt-image-1-mini is the MVP default for faster Vercel-friendly image generation.
  // For the premium version, set OPENAI_IMAGE_MODEL to a higher-quality image model.
  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
  const requestedModel = imageModel;
  const models = Array.from(new Set([requestedModel, "gpt-image-1"]));
  const requestedSize = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const sizes = Array.from(new Set([requestedSize, "1024x1024"]));
  const prompt = buildFinalImagePrompt(book, page);
  const maxAttempts = options.maxAttempts ?? 2;
  let attemptCount = 0;

  for (const model of models) {
    for (const size of sizes) {
      if (attemptCount >= maxAttempts) {
        break;
      }

      attemptCount += 1;

      try {
        const isGptImageModel = model.startsWith("gpt-image");
        const response = await openai.images.generate({
          model,
          prompt,
          size: size as "1024x1024" | "1024x1536" | "1536x1024",
          ...(!isGptImageModel ? { response_format: "b64_json" as const } : {}),
        });

        const image = response.data?.[0];
        if (image?.b64_json) {
          return dataUrlFromBase64(image.b64_json, "image/png");
        }

        if (image?.url) {
          return image.url;
        }
      } catch (error) {
        console.warn(`Image generation failed for page ${page.pageNumber} with ${model}/${size}.`, error);
      }
    }
  }

  if (options.fallbackOnFailure) {
    return buildFallbackIllustration(book, page);
  }

  return undefined;
}

export function buildFallbackIllustration(book: LoreBook, page: BookPage) {
  const palette = book.characterBible.colorPalette || "deep navy, charcoal black, parchment, muted gold";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536" role="img" aria-label="Dark fantasy illustration">
  <defs>
    <radialGradient id="moon" cx="34%" cy="18%" r="35%">
      <stop offset="0%" stop-color="#f2dfaa" stop-opacity=".95"/>
      <stop offset="42%" stop-color="#9fb8d8" stop-opacity=".28"/>
      <stop offset="100%" stop-color="#050711" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#101a2b"/>
      <stop offset="48%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#21150f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" x2="1">
      <stop offset="0%" stop-color="#6f552c"/>
      <stop offset="50%" stop-color="#d9bd78"/>
      <stop offset="100%" stop-color="#8a6231"/>
    </linearGradient>
    <filter id="softBlur"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="1024" height="1536" fill="url(#sky)"/>
  <rect width="1024" height="1536" fill="url(#moon)"/>
  <circle cx="305" cy="225" r="112" fill="#ead9a8" opacity=".82"/>
  <circle cx="348" cy="210" r="116" fill="#101a2b" opacity=".74"/>
  <path d="M0 1120 C190 1028 282 1058 420 960 C585 842 735 866 1024 720 L1024 1536 L0 1536 Z" fill="#03050a" opacity=".92"/>
  <path d="M492 520 C438 652 448 814 384 970 L642 970 C582 810 590 650 532 520 Z" fill="#080b12"/>
  <path d="M410 984 C478 884 548 878 626 984 C652 1054 670 1158 700 1328 L334 1328 C358 1166 381 1052 410 984 Z" fill="#0b0e15"/>
  <path d="M506 488 C575 488 622 541 622 616 C622 690 575 736 506 736 C437 736 392 690 392 616 C392 541 437 488 506 488 Z" fill="#111827"/>
  <path d="M504 430 L538 535 L648 534 L560 599 L594 704 L504 640 L416 704 L450 599 L362 534 L470 535 Z" fill="url(#gold)" opacity=".82"/>
  <path d="M506 752 C430 835 372 971 340 1160" stroke="#d9bd78" stroke-width="9" opacity=".72" fill="none"/>
  <path d="M506 752 C589 842 648 976 694 1160" stroke="#9fb8d8" stroke-width="7" opacity=".36" fill="none"/>
  <g opacity=".55" filter="url(#softBlur)">
    <ellipse cx="210" cy="1260" rx="300" ry="90" fill="#9fb8d8"/>
    <ellipse cx="790" cy="1200" rx="270" ry="100" fill="#d9bd78"/>
  </g>
  <path d="M128 1350 C260 1290 350 1298 512 1248 C675 1298 772 1290 896 1350" stroke="#d9bd78" stroke-width="4" opacity=".3" fill="none"/>
  <metadata>${escapeXml(`${page.chapter} - ${page.title}. Palette: ${palette}`)}</metadata>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };

    return entities[character];
  });
}
