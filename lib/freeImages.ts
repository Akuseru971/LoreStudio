import "server-only";

import { FREE_IMAGE_PAGE_COUNT, FREE_IMAGE_PAGES } from "@/lib/image-config";
import {
  claimPageImageGeneration,
  getBookByAccessToken,
  getBookById,
  markPageImageFailed,
  mergeBookAssets,
  reloadAndVerifyPageImageClaim,
  saveBookAsset,
  stampMissingGeneratingTimestamp,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getImageForPage, isIllustrationReady, resolveImageDisplayUrl, type BookImagesInput } from "@/lib/book-images";
import {
  getPageGenerationStatus,
  isImageFreshlyGenerating,
  verifyImageGenerationClaimOwnership,
} from "@/lib/imageGenerationTimestamps";
import { generateBookPageImage } from "@/lib/images";
import { buildFinalImagePrompt } from "@/lib/prompts";
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, normalizeImageQuality } from "@/lib/server/ai-config";
import { openai } from "@/lib/server/openai";
import { IMAGE_GENERATION_TIMEOUT_MS, withTimeout } from "@/lib/server/generation-timeouts";
import type { BookPage, LoreBook, StoredBook } from "@/lib/types";
import { dataUrlFromBase64, normalizeLoreBook } from "@/lib/utils";

export { FREE_IMAGE_PAGES } from "@/lib/image-config";

const FREE_PREVIEW_PARALLEL_PAGES = [2, 3] as const;

export type GenerateStoredFreeImageResult = {
  book: StoredBook | null;
  generated: boolean;
  claimLost: boolean;
};

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
  return FREE_IMAGE_PAGES.filter((pageNumber) => isIllustrationReady(getImageForPage(input, pageNumber))).length;
}

export function getMissingFreeImagePages(storedBook: StoredBook) {
  const input = getFreeImagePagesInput(storedBook);
  return FREE_IMAGE_PAGES.filter((pageNumber) => !isIllustrationReady(getImageForPage(input, pageNumber)));
}

export function areFreeIllustrationsReady(storedBook: StoredBook) {
  return getMissingFreeImagePages(storedBook).length === 0;
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

  return FREE_PREVIEW_PARALLEL_PAGES.filter((pageNumber) =>
    isFreePageEligibleForGeneration(storedBook, pageNumber, input),
  );
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
  const referencePrompt = `Image 1 is the established character reference. Preserve the exact same character appearance, face, clothing palette, and visual style from Image 1.\n\n${prompt}`;

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
  if (pageNumber > FREE_IMAGE_PAGE_COUNT) {
    if (pageNumber === 4) {
      console.warn("[BLOCKED_PAGE_4_FREE_GENERATION]");
    }
    return { book: null, generated: false, claimLost: false };
  }

  const claim = await claimPageImageGeneration(bookId, pageNumber);
  if (!claim) {
    const refreshedBook = await getBookById(bookId);
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
    return {
      book: refreshedBook || (await getBookById(bookId)),
      generated: false,
      claimLost: true,
    };
  }

  const { claimId } = claim;
  let latestBook = (await reloadAndVerifyPageImageClaim(bookId, pageNumber, claimId)) || claim.book;

  if (!latestBook || !verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
    return { book: latestBook, generated: false, claimLost: true };
  }

  const verifyState = getPageGenerationStatus(latestBook, pageNumber);
  if (verifyState.isReady) {
    return { book: latestBook, generated: false, claimLost: false };
  }

  if (!verifyState.timestamp) {
    const stampedBook = await stampMissingGeneratingTimestamp(bookId, pageNumber);
    latestBook = (await reloadAndVerifyPageImageClaim(bookId, pageNumber, claimId)) || stampedBook || latestBook;
    if (!latestBook || !verifyImageGenerationClaimOwnership(latestBook, pageNumber, claimId)) {
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
    return { book: await getBookById(bookId), generated: false, claimLost: true };
  }

  try {
    console.log("[OPENAI_IMAGE_API_CALL_START]", {
      bookId,
      pageNumber,
      claimId,
      usesPage1Reference: pageNumber !== 1 && Boolean(referenceImageUrl),
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

async function buildFreePreviewGenerationResult(
  accessToken: string,
  storedBook: StoredBook,
  pageNumber: number | null,
  generationResult: GenerateStoredFreeImageResult | null,
) {
  if (generationResult?.claimLost) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber,
      generated: false,
      done: false,
      retryable: true as const,
      reason: "claim_lost_to_another_request" as const,
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
  const missingFreePages = getMissingFreeImagePages(refreshedBook);
  const allFreeImagesReady = missingFreePages.length === 0;

  if (allFreeImagesReady) {
    await updateGenerationProgress(refreshedBook.id, "ready_free", { generationError: null });
  } else if (generationResult?.generated) {
    await updateGenerationProgress(refreshedBook.id, "generating_images", { generationError: null });
  }

  return {
    storedBook: refreshedBook,
    pageNumber,
    generated: Boolean(generationResult?.generated),
    done: allFreeImagesReady || findNextMissingFreeImagePage(refreshedBook) === null,
    allFreeImagesReady,
    readyFreeImageCount: countReadyFreeImages(refreshedBook),
    missingFreePages,
  };
}

function isValidFreePreviewTargetPage(pageNumber: number | undefined) {
  return (
    pageNumber !== undefined &&
    Number.isInteger(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= FREE_IMAGE_PAGE_COUNT
  );
}

export async function generateNextFreeImage(accessToken: string, requestedPageNumber?: number) {
  console.log("[FREE_IMAGE_GENERATION_PAGES]", [...FREE_IMAGE_PAGES]);

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
      generated: false,
      done: true,
      allFreeImagesReady: true,
      readyFreeImageCount: FREE_IMAGE_PAGE_COUNT,
      missingFreePages: [] as number[],
    };
  }

  if (requestedPageNumber !== undefined && !isValidFreePreviewTargetPage(requestedPageNumber)) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber: null,
      generated: false,
      done: findNextMissingFreeImagePage(refreshedBook) === null,
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const pageNumber =
    requestedPageNumber ?? getFreePreviewGenerationTargets(storedBook)[0] ?? findNextMissingFreeImagePage(storedBook);

  if (!pageNumber) {
    const refreshedBook = (await getBookByAccessToken(accessToken)) || storedBook;
    return {
      storedBook: refreshedBook,
      pageNumber: null,
      generated: false,
      done: findNextMissingFreeImagePage(refreshedBook) === null,
      allFreeImagesReady: areFreeIllustrationsReady(refreshedBook),
      readyFreeImageCount: countReadyFreeImages(refreshedBook),
      missingFreePages: getMissingFreeImagePages(refreshedBook),
    };
  }

  const latestBook = (await getBookByAccessToken(accessToken)) || storedBook;
  const input = getFreeImagePagesInput(latestBook);

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
    return buildFreePreviewGenerationResult(accessToken, latestBook, pageNumber, null);
  }

  if (pageNumber === 2 || pageNumber === 3) {
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
    console.log("[FREE_PREVIEW_PAGE_1_READY_START_PARALLEL_2_3]");
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

  console.log("[FREE_IMAGES_PARALLEL_START]", { pages: [...FREE_PREVIEW_PARALLEL_PAGES], at: Date.now() });

  await Promise.allSettled(
    FREE_PREVIEW_PARALLEL_PAGES.map((pageNumber) =>
      generateAndStoreFreeImageForPage({
        accessToken,
        bookId: refreshedBook.id,
        book: refreshedBook.free_book as LoreBook,
        pageNumber,
      }),
    ),
  );

  console.log("[FREE_IMAGES_PARALLEL_DONE]", { pages: [...FREE_PREVIEW_PARALLEL_PAGES], at: Date.now() });

  const finalBook = await getBookByAccessToken(accessToken);
  if (!finalBook) {
    throw new Error("Book not found after image generation.");
  }

  return finalBook;
}
