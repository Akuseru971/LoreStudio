import "server-only";

import {
  FREE_IMAGE_PAGE_COUNT,
  FREE_IMAGE_PAGES,
  FREE_PREVIEW_POSTER_IMAGE_KEY,
  FREE_PREVIEW_STORY_IMAGE_PAGES,
} from "@/lib/image-config";
import {
  claimPageImageGeneration,
  claimPreviewCoverGeneration,
  cleanupInvalidStoryPage3ClaimState,
  getBookByAccessToken,
  getBookById,
  markPageImageFailed,
  markPreviewCoverFailed,
  mergeBookAssets,
  reloadAndVerifyPageImageClaim,
  reloadAndVerifyPreviewCoverClaim,
  saveBookAsset,
  savePreviewPosterAsset,
  stampMissingGeneratingTimestamp,
  stampMissingPreviewCoverTimestamp,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, isIllustrationReady, resolveImageDisplayUrl, type BookImagesInput } from "@/lib/book-images";
import { getDirectImageUrl, getImageStoragePath } from "@/lib/book-image-utils";
import {
  getPageGenerationStatus,
  getPreviewCoverGenerationStatus,
  isImageFreshlyGenerating,
  isPreviewCoverFreshlyGenerating,
  verifyImageGenerationClaimOwnership,
  verifyPreviewCoverClaimOwnership,
} from "@/lib/imageGenerationTimestamps";
import { generateBookPageImage } from "@/lib/images";
import { buildFinalImagePrompt, buildFreePosterRevealPrompt } from "@/lib/prompts";
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, normalizeImageQuality } from "@/lib/server/ai-config";
import { openai } from "@/lib/server/openai";
import { IMAGE_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { BookPageImage, BookPage, LoreBook, StoredBook } from "@/lib/types";
import { dataUrlFromBase64, normalizeLoreBook } from "@/lib/utils";

export { FREE_IMAGE_PAGES } from "@/lib/image-config";

export type GenerateNextFreeImageOptions = {
  pageNumber?: number;
  previewCover?: boolean;
};

const FREE_PREVIEW_PARALLEL_STORY_PAGES = [2] as const;

function getPreviewPosterImage(storedBook: StoredBook): BookPageImage | null {
  const rawImage = storedBook.images[FREE_PREVIEW_POSTER_IMAGE_KEY];
  if (!rawImage) {
    return null;
  }

  if (typeof rawImage === "string") {
    const trimmed = rawImage.trim();
    if (!trimmed) {
      return null;
    }

    const storagePath = getImageStoragePath(trimmed);
    return {
      status: "ready",
      url: storagePath ? null : trimmed,
      storagePath,
      generatedAt: null,
    } as BookPageImage;
  }

  return rawImage;
}

export function isPreviewPosterReady(storedBook: StoredBook) {
  return getFreePreviewReadiness(storedBook).previewCoverReady;
}

export type FreePreviewReadiness = {
  page1Ready: boolean;
  page2Ready: boolean;
  previewCoverReady: boolean;
  readyPreviewAssetsCount: number;
  freePreviewReady: boolean;
};

function isStoryPreviewImageReady(storedBook: StoredBook, pageNumber: number) {
  const input = getFreeImagePagesInput(storedBook);
  const image = getImageForPage(input, pageNumber);
  if (!isIllustrationReady(image)) {
    return false;
  }

  return Boolean(getDirectImageUrl(image) || getImageStoragePath(image));
}

function hasUsablePreviewCoverAsset(image: BookPageImage | null) {
  if (!image) {
    return false;
  }

  const storagePath = getImageStoragePath(image);
  if (storagePath?.includes("page-NaN")) {
    return false;
  }

  return Boolean(getDirectImageUrl(image) || storagePath);
}

export function getFreePreviewReadiness(storedBook: StoredBook): FreePreviewReadiness {
  const page1Ready = isStoryPreviewImageReady(storedBook, 1);
  const page2Ready = isStoryPreviewImageReady(storedBook, 2);
  const previewCoverImage = getPreviewPosterImage(storedBook);
  const previewCoverReady = hasUsablePreviewCoverAsset(previewCoverImage);
  const readyPreviewAssetsCount = [page1Ready, page2Ready, previewCoverReady].filter(Boolean).length;

  return {
    page1Ready,
    page2Ready,
    previewCoverReady,
    readyPreviewAssetsCount,
    freePreviewReady: page1Ready && page2Ready && previewCoverReady,
  };
}

export type GenerateStoredFreeImageResult = {
  book: StoredBook | null;
  generated: boolean;
  claimLost: boolean;
};

export type FreePreviewGenerationResult = {
  storedBook: StoredBook;
  pageNumber: number | null;
  previewCover?: boolean;
  generated: boolean;
  done: boolean;
  allFreeImagesReady: boolean;
  readyFreeImageCount: number;
  missingFreePages: number[];
  skipped?: boolean;
  reason?: string;
  retryable?: boolean;
};

function isFreePreviewStoryPageAlreadyReady(storedBook: StoredBook, pageNumber: number) {
  const input = getFreeImagePagesInput(storedBook);
  const image = getImageForPage(input, pageNumber);
  if (!isIllustrationReady(image)) {
    return false;
  }

  return Boolean(getDirectImageUrl(image) || getImageStoragePath(image));
}

function buildFreePreviewSkipReadyResult(
  storedBook: StoredBook,
  pageNumber: number | null,
  previewCover = false,
): FreePreviewGenerationResult {
  console.log("[FREE_IMAGE_SKIP_ALREADY_READY]", { pageNumber, previewCover });

  return {
    storedBook,
    pageNumber,
    previewCover,
    generated: false,
    done: !isPreviewCoverMissing(storedBook) && findNextMissingFreeImagePage(storedBook) === null,
    allFreeImagesReady: areFreeIllustrationsReady(storedBook),
    readyFreeImageCount: countReadyFreeImages(storedBook),
    missingFreePages: getMissingFreeImagePages(storedBook),
    skipped: true,
    reason: previewCover ? "preview_cover_already_ready" : "page_already_ready",
  };
}

function logClaimLostSkipOpenAi(bookId: string, target: { pageNumber?: number; previewCover?: boolean }) {
  console.log("[IMAGE_GENERATION_CLAIM_LOST_SKIP_OPENAI]", {
    bookId,
    ...target,
  });
}

export function getFreeImagePagesInput(storedBook: StoredBook): BookImagesInput {
  return {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages: storedBook.free_book?.pages,
  };
}

export function isFreePage1Ready(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  return isIllustrationReady(getImageForPage(input, 1));
}

export function countReadyFreeImages(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  const readyStoryPages = FREE_IMAGE_PAGES.filter((pageNumber) =>
    isIllustrationReady(getImageForPage(input, pageNumber)),
  ).length;

  return readyStoryPages + (isPreviewPosterReady(storedBook) ? 1 : 0);
}

export function isPreviewCoverMissing(storedBook: StoredBook) {
  return !isPreviewPosterReady(storedBook);
}

export function getMissingFreeImagePages(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  return FREE_IMAGE_PAGES.filter((pageNumber) => !isIllustrationReady(getImageForPage(input, pageNumber)));
}

export function areFreeIllustrationsReady(storedBook: StoredBook) {
  return getFreePreviewReadiness(storedBook).freePreviewReady;
}

function isFreePageEligibleForGeneration(
  storedBook: StoredBook,
  pageNumber: number,
  input: BookImagesInput,
) {
  const image = getImageForPage(input, pageNumber);
  if (isIllustrationReady(image)) {
    return false;
  }

  if (image?.status === "generating" && isImageFreshlyGenerating(storedBook, pageNumber, input)) {
    return false;
  }

  return true;
}

function isPreviewCoverEligibleForGeneration(storedBook: StoredBook) {
  const previewCoverImage = getPreviewPosterImage(storedBook);
  if (hasUsablePreviewCoverAsset(previewCoverImage)) {
    return false;
  }

  if (
    storedBook.image_status[FREE_PREVIEW_POSTER_IMAGE_KEY] === "generating" &&
    isPreviewCoverFreshlyGenerating(storedBook)
  ) {
    return false;
  }

  return true;
}

export function findNextMissingFreeImagePage(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  const page1Ready = isFreePage1Ready(storedBook);

  for (const pageNumber of FREE_IMAGE_PAGES) {
    if (!page1Ready && pageNumber !== 1) {
      continue;
    }

    if (isFreePageEligibleForGeneration(storedBook, pageNumber, input)) {
      return pageNumber;
    }
  }

  return null;
}

export function getFreePreviewGenerationTargets(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);

  if (!isFreePage1Ready(storedBook)) {
    return isFreePageEligibleForGeneration(storedBook, 1, input) ? [1] : [];
  }

  const targets: Array<number | "preview_cover"> = [];

  for (const pageNumber of FREE_PREVIEW_PARALLEL_STORY_PAGES) {
    if (isFreePageEligibleForGeneration(storedBook, pageNumber, input)) {
      targets.push(pageNumber);
    }
  }

  if (isPreviewCoverEligibleForGeneration(storedBook)) {
    targets.push("preview_cover");
  }

  return targets;
}

async function loadReferenceImageBuffer(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    if (!base64) {
      throw new Error("Invalid reference image data URL.");
    }

    return Buffer.from(base64, "base64");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch reference image.");
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getFreePreviewPage1ReferenceUrl(storedBook: StoredBook) {
  if (!isFreePage1Ready(storedBook)) {
    return null;
  }

  const input = getFreeImagePagesInput(storedBook);
  const page1Image = getImageForPage(input, 1);
  return resolveImageDisplayUrl(page1Image);
}

async function generateFreePreviewPosterImage(book: LoreBook, referenceImageUrl: string) {
  const championName = book.characterBible?.name?.trim() || book.title?.trim() || "Your legend";
  const posterPrompt = buildFreePosterRevealPrompt(book, championName);
  const referencePrompt = `Image 1 is the character appearance reference only.

Preserve from Image 1:
- the same character identity and face
- the same hairstyle
- the same skin tone
- the same general outfit design
- the same overall character design and visual style
- the same region-inspired fantasy identity

Do NOT copy from Image 1:
- pose
- posture
- framing
- camera angle
- body position
- composition

Create a premium cinematic collector poster / book cover composition. Keep the character recognizable, but use a new dramatic profile close-up and heroic poster layout.

${posterPrompt}`;

  try {
    const imageBuffer = await loadReferenceImageBuffer(referenceImageUrl);
    const referenceFile = new File([imageBuffer], "page-1-reference.png", { type: "image/png" });
    const response = await openai.images.edit({
      model: IMAGE_MODEL,
      image: referenceFile,
      prompt: referencePrompt,
      size: IMAGE_SIZE as "1024x1024" | "1024x1536" | "1536x1024",
      quality: normalizeImageQuality(IMAGE_QUALITY),
    });

    const image = response.data?.[0];
    if (image?.b64_json) {
      return dataUrlFromBase64(image.b64_json, "image/png");
    }

    if (image?.url) {
      return image.url;
    }
  } catch (error) {
    console.warn("[FREE_PREVIEW_POSTER_IMAGE_FALLBACK]", {
      message: error instanceof Error ? error.message : error,
    });
  }

  return generateBookPageImage(book, book.pages[0], {
    fallbackOnFailure: false,
    maxAttempts: 2,
  });
}

async function generateFreePreviewPageImage(
  book: LoreBook,
  page: BookPage,
  referenceImageUrl: string | null,
) {
  if (page.pageNumber === 1 || !referenceImageUrl) {
    return generateBookPageImage(book, page, {
      fallbackOnFailure: false,
      maxAttempts: 2,
    });
  }

  const prompt = buildFinalImagePrompt(book, page);
  const referencePrompt = `Image 1 is the character appearance reference only.

Preserve from Image 1:
- the same character identity and face
- the same hairstyle
- the same skin tone
- the same general outfit design
- the same overall character design and visual style

Do NOT copy from Image 1:
- pose
- posture
- framing
- camera angle
- body position
- composition

Create a new illustrated story moment for this page. Keep the character recognizable, but show a different action, a different pose, different posture, and a different scene composition. Do not recreate the same image with minor changes.

${prompt}`;

  try {
    const imageBuffer = await loadReferenceImageBuffer(referenceImageUrl);
    const referenceFile = new File([imageBuffer], "page-1-reference.png", { type: "image/png" });
    const response = await openai.images.edit({
      model: IMAGE_MODEL,
      image: referenceFile,
      prompt: referencePrompt,
      size: IMAGE_SIZE as "1024x1024" | "1024x1536" | "1536x1024",
      quality: normalizeImageQuality(IMAGE_QUALITY),
    });

    const image = response.data?.[0];
    if (image?.b64_json) {
      return dataUrlFromBase64(image.b64_json, "image/png");
    }

    if (image?.url) {
      return image.url;
    }
  } catch (error) {
    console.warn("[FREE_PREVIEW_REFERENCE_IMAGE_FALLBACK]", {
      pageNumber: page.pageNumber,
      message: error instanceof Error ? error.message : error,
    });
  }

  return generateBookPageImage(book, page, {
    fallbackOnFailure: false,
    maxAttempts: 2,
  });
}

export async function generateAndStoreFreeImageForPage({
  accessToken,
  bookId,
  book,
  pageNumber,
}: {
  accessToken: string;
  bookId: string;
  book: LoreBook;
  pageNumber: number;
}): Promise<GenerateStoredFreeImageResult> {
  if (pageNumber > FREE_PREVIEW_STORY_IMAGE_PAGES.length) {
    if (pageNumber === 4) {
      console.warn("[BLOCKED_PAGE_4_FREE_GENERATION]");
    }
    return { book: null, generated: false, claimLost: false };
  }

  const latestBeforeClaim = await getBookById(bookId);
  if (latestBeforeClaim && isFreePreviewStoryPageAlreadyReady(latestBeforeClaim, pageNumber)) {
    console.log("[FREE_IMAGE_SKIP_ALREADY_READY]", { pageNumber });
    return { book: latestBeforeClaim, generated: false, claimLost: false };
  }

  const claim = await claimPageImageGeneration(bookId, pageNumber);
  if (!claim) {
    const refreshedBook = await getBookById(bookId);
    if (refreshedBook && isFreePreviewStoryPageAlreadyReady(refreshedBook, pageNumber)) {
      console.log("[FREE_IMAGE_SKIP_ALREADY_READY]", { pageNumber });
      return { book: refreshedBook, generated: false, claimLost: false };
    }

    if (refreshedBook && isImageFreshlyGenerating(refreshedBook, pageNumber)) {
      const state = getPageGenerationStatus(refreshedBook, pageNumber);
      console.log("[IMAGE_GENERATION_SKIP_ALREADY_GENERATING]", {
        bookId,
        pageNumber,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
        ageMs: state.ageMs,
      });
    }

    logClaimLostSkipOpenAi(bookId, { pageNumber });
    return {
      book: refreshedBook || (await getBookById(bookId)),
      generated: false,
      claimLost: true,
    };
  }

  const { claimId } = claim;
  let latestBook = (await reloadAndVerifyPageImageClaim(bookId, pageNumber, claimId)) || claim.book;

  if (!latestBook || !verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
    logClaimLostSkipOpenAi(bookId, { pageNumber });
    return { book: latestBook, generated: false, claimLost: true };
  }

  const verifyState = getPageGenerationStatus(latestBook, pageNumber);
  if (verifyState.isReady || isFreePreviewStoryPageAlreadyReady(latestBook, pageNumber)) {
    console.log("[FREE_IMAGE_SKIP_ALREADY_READY]", { pageNumber });
    return { book: latestBook, generated: false, claimLost: false };
  }

  if (!verifyState.timestamp) {
    const stampedBook = await stampMissingGeneratingTimestamp(bookId, pageNumber);
    latestBook = (await reloadAndVerifyPageImageClaim(bookId, pageNumber, claimId)) || stampedBook || latestBook;
    if (!latestBook || !verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
      logClaimLostSkipOpenAi(bookId, { pageNumber });
      return { book: latestBook, generated: false, claimLost: true };
    }
  }

  if (pageNumber !== 1 && !isFreePage1Ready(latestBook)) {
    return { book: latestBook, generated: false, claimLost: false };
  }

  let normalizedBook = normalizeLoreBook(book);
  let referenceImageUrl: string | null = null;

  if (pageNumber !== 1) {
    const mergedBook = await mergeBookAssets(
      latestBook.free_book || book,
      latestBook.images,
      latestBook.audio,
    );
    normalizedBook = normalizeLoreBook(mergedBook);
    referenceImageUrl = await getFreePreviewPage1ReferenceUrl(latestBook);
  }

  const page = normalizedBook.pages.find((item) => item.pageNumber === pageNumber);
  if (!page) {
    await markPageImageFailed(bookId, pageNumber, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: `Page ${pageNumber} is missing.`,
    });
    return { book: latestBook, generated: false, claimLost: false };
  }

  latestBook = (await reloadAndVerifyPageImageClaim(bookId, pageNumber, claimId)) || latestBook;
  if (!latestBook) {
    logClaimLostSkipOpenAi(bookId, { pageNumber });
    return { book: await getBookById(bookId), generated: false, claimLost: true };
  }

  if (isFreePreviewStoryPageAlreadyReady(latestBook, pageNumber)) {
    console.log("[FREE_IMAGE_SKIP_ALREADY_READY]", { pageNumber });
    return { book: latestBook, generated: false, claimLost: false };
  }

  try {
    console.log("[OPENAI_IMAGE_API_CALL_START]", {
      bookId,
      pageNumber,
      claimId,
      usesPage1Reference: pageNumber !== 1 && Boolean(referenceImageUrl),
      previewCover: false,
    });

    const imageUrl = await withTimeout(
      generateFreePreviewPageImage(normalizedBook, page, referenceImageUrl),
      IMAGE_GENERATION_TIMEOUT_MS,
      `FREE_IMAGE_PAGE_${pageNumber}`,
    );

    if (!imageUrl) {
      await markPageImageFailed(bookId, pageNumber, claimId);
      console.error("[IMAGE_GENERATION_ERROR]", {
        pageNumber,
        message: "No image URL returned.",
      });
      return { book: latestBook, generated: false, claimLost: false };
    }

    const savedBook = await saveBookAsset(accessToken, pageNumber, "image", imageUrl, { claimId });
    return { book: savedBook, generated: true, claimLost: false };
  } catch (error) {
    await markPageImageFailed(bookId, pageNumber, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      pageNumber,
      message: error instanceof Error ? error.message : "Image generation failed.",
    });
    return { book: latestBook, generated: false, claimLost: false };
  }
}

export async function generateAndStoreFreePreviewCover({
  accessToken,
  bookId,
  book,
}: {
  accessToken: string;
  bookId: string;
  book: LoreBook;
}): Promise<GenerateStoredFreeImageResult> {
  const latestBeforeClaim = await getBookById(bookId);
  if (latestBeforeClaim && isPreviewPosterReady(latestBeforeClaim)) {
    console.log("[FREE_PREVIEW_COVER_SKIP_ALREADY_READY]");
    return { book: latestBeforeClaim, generated: false, claimLost: false };
  }

  await cleanupInvalidStoryPage3ClaimState(bookId);

  const claim = await claimPreviewCoverGeneration(bookId);
  if (!claim) {
    const refreshedBook = await getBookById(bookId);
    if (refreshedBook && isPreviewPosterReady(refreshedBook)) {
      console.log("[FREE_PREVIEW_COVER_SKIP_ALREADY_READY]");
      return { book: refreshedBook, generated: false, claimLost: false };
    }

    if (refreshedBook && isPreviewCoverFreshlyGenerating(refreshedBook)) {
      const state = getPreviewCoverGenerationStatus(refreshedBook);
      console.log("[IMAGE_GENERATION_SKIP_ALREADY_GENERATING]", {
        bookId,
        assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
        ageMs: state.ageMs,
      });
    }

    logClaimLostSkipOpenAi(bookId, { previewCover: true });
    return {
      book: refreshedBook || (await getBookById(bookId)),
      generated: false,
      claimLost: true,
    };
  }

  const { claimId } = claim;
  let latestBook = (await reloadAndVerifyPreviewCoverClaim(bookId, claimId)) || claim.book;

  if (!latestBook || !verifyPreviewCoverClaimOwnership(latestBook, claimId)) {
    logClaimLostSkipOpenAi(bookId, { previewCover: true });
    return { book: latestBook, generated: false, claimLost: true };
  }

  const verifyState = getPreviewCoverGenerationStatus(latestBook);
  if (verifyState.isReady || isPreviewPosterReady(latestBook)) {
    console.log("[FREE_PREVIEW_COVER_SKIP_ALREADY_READY]");
    return { book: latestBook, generated: false, claimLost: false };
  }

  if (!verifyState.timestamp) {
    const stampedBook = await stampMissingPreviewCoverTimestamp(bookId);
    latestBook = (await reloadAndVerifyPreviewCoverClaim(bookId, claimId)) || stampedBook || latestBook;
    if (!latestBook || !verifyPreviewCoverClaimOwnership(latestBook, claimId)) {
      logClaimLostSkipOpenAi(bookId, { previewCover: true });
      return { book: latestBook, generated: false, claimLost: true };
    }
  }

  if (!isFreePage1Ready(latestBook)) {
    return { book: latestBook, generated: false, claimLost: false };
  }

  const mergedBook = await mergeBookAssets(
    latestBook.free_book || book,
    latestBook.images,
    latestBook.audio,
  );
  const normalizedBook = normalizeLoreBook(mergedBook);
  const referenceImageUrl = await getFreePreviewPage1ReferenceUrl(latestBook);

  latestBook = (await reloadAndVerifyPreviewCoverClaim(bookId, claimId)) || latestBook;
  if (!latestBook) {
    logClaimLostSkipOpenAi(bookId, { previewCover: true });
    return { book: await getBookById(bookId), generated: false, claimLost: true };
  }

  if (isPreviewPosterReady(latestBook)) {
    console.log("[FREE_PREVIEW_COVER_SKIP_ALREADY_READY]");
    return { book: latestBook, generated: false, claimLost: false };
  }

  if (!referenceImageUrl) {
    await markPreviewCoverFailed(bookId, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
      message: "Missing page 1 reference for preview cover.",
    });
    return { book: latestBook, generated: false, claimLost: false };
  }

  try {
    console.log("[OPENAI_IMAGE_API_CALL_START]", {
      bookId,
      assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
      claimId,
      usesPage1Reference: true,
      previewCover: true,
    });

    const imageUrl = await withTimeout(
      generateFreePreviewPosterImage(normalizedBook, referenceImageUrl),
      IMAGE_GENERATION_TIMEOUT_MS,
      "FREE_PREVIEW_POSTER",
    );

    if (!imageUrl) {
      await markPreviewCoverFailed(bookId, claimId);
      console.error("[IMAGE_GENERATION_ERROR]", {
        assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
        message: "No image URL returned.",
      });
      return { book: latestBook, generated: false, claimLost: false };
    }

    const savedBook = await savePreviewPosterAsset(accessToken, imageUrl, { claimId });
    return { book: savedBook, generated: true, claimLost: false };
  } catch (error) {
    await markPreviewCoverFailed(bookId, claimId);
    console.error("[IMAGE_GENERATION_ERROR]", {
      assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
      message: error instanceof Error ? error.message : "Preview cover generation failed.",
    });
    return { book: latestBook, generated: false, claimLost: false };
  }
}

async function buildFreePreviewGenerationResult(
  accessToken: string,
  storedBook: StoredBook,
  pageNumber: number | null,
  generationResult: GenerateStoredFreeImageResult | null,
  previewCover = false,
): Promise<FreePreviewGenerationResult> {
  if (generationResult?.claimLost) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber,
      previewCover,
      generated: false,
      done: false,
      retryable: true,
      reason: "claim_lost_to_another_request",
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
  const allFreeImagesReady = areFreeIllustrationsReady(refreshedBook);
  const readyFreeImageCount = countReadyFreeImages(refreshedBook);

  if (allFreeImagesReady) {
    await updateGenerationProgress(refreshedBook.id, "ready_free", { generationError: null });
  } else if (generationResult?.generated) {
    await updateGenerationProgress(refreshedBook.id, "generating_images", { generationError: null });
  }

  return {
    storedBook: refreshedBook,
    pageNumber,
    previewCover,
    generated: Boolean(generationResult?.generated),
    done:
      allFreeImagesReady ||
      (findNextMissingFreeImagePage(refreshedBook) === null && !isPreviewCoverMissing(refreshedBook)),
    allFreeImagesReady,
    readyFreeImageCount,
    missingFreePages: getMissingFreeImagePages(refreshedBook),
  };
}

function normalizeGenerateNextFreeImageOptions(
  options?: number | GenerateNextFreeImageOptions,
): GenerateNextFreeImageOptions {
  if (typeof options === "number") {
    return { pageNumber: options };
  }

  return options ?? {};
}

function isValidFreePreviewTargetPage(pageNumber: number | undefined) {
  return (
    pageNumber !== undefined &&
    Number.isInteger(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= FREE_PREVIEW_STORY_IMAGE_PAGES.length
  );
}

export async function generateNextFreeImage(
  accessToken: string,
  options?: number | GenerateNextFreeImageOptions,
) {
  const { pageNumber: requestedPageNumber, previewCover: requestedPreviewCover } =
    normalizeGenerateNextFreeImageOptions(options);

  console.log("[FREE_IMAGE_GENERATION_PAGES]", {
    storyPages: [...FREE_IMAGE_PAGES],
    previewCoverKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
  });

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const sourceBook = storedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  if (areFreeIllustrationsReady(storedBook)) {
    return {
      storedBook,
      pageNumber: null,
      previewCover: false,
      generated: false,
      done: true,
      allFreeImagesReady: true,
      readyFreeImageCount: FREE_IMAGE_PAGE_COUNT,
      missingFreePages: [] as number[],
    };
  }

  if (requestedPreviewCover) {
    const latestBook = (await getBookByAccessToken(accessToken)) || storedBook;

    if (isPreviewPosterReady(latestBook)) {
      return buildFreePreviewSkipReadyResult(latestBook, null, true);
    }

    if (!isFreePage1Ready(latestBook)) {
      return {
        storedBook: latestBook,
        pageNumber: null,
        previewCover: true,
        generated: false,
        done: false,
        allFreeImagesReady: false,
        readyFreeImageCount: countReadyFreeImages(latestBook),
        missingFreePages: getMissingFreeImagePages(latestBook),
      };
    }

    if (!isPreviewCoverEligibleForGeneration(latestBook)) {
      if (isPreviewPosterReady(latestBook)) {
        return buildFreePreviewSkipReadyResult(latestBook, null, true);
      }

      return buildFreePreviewGenerationResult(accessToken, latestBook, null, null, true);
    }

    console.log("[FREE_PREVIEW_PARALLEL_REQUEST_START]", { previewCover: true });
    console.log("[FREE_IMAGE_GENERATION_START]", { accessToken, previewCover: true, at: Date.now() });

    const generationResult = await generateAndStoreFreePreviewCover({
      accessToken,
      bookId: latestBook.id,
      book: sourceBook,
    });

    console.log("[FREE_IMAGE_GENERATION_DONE]", { accessToken, previewCover: true, at: Date.now() });

    return buildFreePreviewGenerationResult(accessToken, latestBook, null, generationResult, true);
  }

  if (requestedPageNumber !== undefined && !isValidFreePreviewTargetPage(requestedPageNumber)) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber: null,
      generated: false,
      done:
        findNextMissingFreeImagePage(refreshedBook) === null && !isPreviewCoverMissing(refreshedBook),
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const nextTarget = requestedPageNumber ?? getFreePreviewGenerationTargets(storedBook)[0] ?? null;

  if (nextTarget === "preview_cover") {
    return generateNextFreeImage(accessToken, { previewCover: true });
  }

  const pageNumber = typeof nextTarget === "number" ? nextTarget : findNextMissingFreeImagePage(storedBook);

  if (!pageNumber) {
    if (isPreviewCoverMissing(storedBook)) {
      return generateNextFreeImage(accessToken, { previewCover: true });
    }

    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber: null,
      generated: false,
      done: !isPreviewCoverMissing(refreshedBook),
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const latestBook = (await getBookByAccessToken(accessToken)) || storedBook;
  const input = getFreeImagePagesInput(latestBook);

  if (isFreePreviewStoryPageAlreadyReady(latestBook, pageNumber)) {
    return buildFreePreviewSkipReadyResult(latestBook, pageNumber);
  }

  if (pageNumber !== 1 && !isFreePage1Ready(latestBook)) {
    return {
      storedBook: latestBook,
      pageNumber,
      generated: false,
      done: false,
      allFreeImagesReady: false,
      readyFreeImageCount: countReadyFreeImages(latestBook),
      missingFreePages: getMissingFreeImagePages(latestBook),
    };
  }

  if (!isFreePageEligibleForGeneration(latestBook, pageNumber, input)) {
    if (isFreePreviewStoryPageAlreadyReady(latestBook, pageNumber)) {
      return buildFreePreviewSkipReadyResult(latestBook, pageNumber);
    }

    return buildFreePreviewGenerationResult(accessToken, latestBook, pageNumber, null);
  }

  if (pageNumber === 2) {
    console.log("[FREE_PREVIEW_PARALLEL_REQUEST_START]", { pageNumber });
  }

  console.log("[FREE_IMAGE_GENERATION_START]", { accessToken, pageNumber, at: Date.now() });

  const generationResult = await generateAndStoreFreeImageForPage({
    accessToken,
    bookId: latestBook.id,
    book: sourceBook,
    pageNumber,
  });

  console.log("[FREE_IMAGE_GENERATION_DONE]", { accessToken, pageNumber, at: Date.now() });

  if (pageNumber === 1 && generationResult.generated) {
    console.log("[FREE_PREVIEW_PAGE_1_READY_START_PARALLEL_2_POSTER]");
  }

  return buildFreePreviewGenerationResult(accessToken, latestBook, pageNumber, generationResult);
}

export async function generateFreeBookImages(accessToken: string, book: LoreBook): Promise<StoredBook> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  await generateAndStoreFreeImageForPage({
    accessToken,
    bookId: storedBook.id,
    book,
    pageNumber: 1,
  });

  const refreshedBook = await getBookByAccessToken(accessToken);
  if (!refreshedBook?.free_book) {
    throw new Error("Book not found after page 1 generation.");
  }

  console.log("[FREE_IMAGES_PARALLEL_START]", {
    storyPages: [...FREE_PREVIEW_PARALLEL_STORY_PAGES],
    previewCover: true,
    at: Date.now(),
  });

  await Promise.allSettled([
    ...FREE_PREVIEW_PARALLEL_STORY_PAGES.map((pageNumber) =>
      generateAndStoreFreeImageForPage({
        accessToken,
        bookId: refreshedBook.id,
        book: refreshedBook.free_book as LoreBook,
        pageNumber,
      }),
    ),
    generateAndStoreFreePreviewCover({
      accessToken,
      bookId: refreshedBook.id,
      book: refreshedBook.free_book as LoreBook,
    }),
  ]);

  console.log("[FREE_IMAGES_PARALLEL_DONE]", {
    storyPages: [...FREE_PREVIEW_PARALLEL_STORY_PAGES],
    previewCover: true,
    at: Date.now(),
  });

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found after image generation.");
  }

  return finalBook;
}
