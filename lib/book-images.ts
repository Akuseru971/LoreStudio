import "server-only";

import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { FREE_PREVIEW_POSTER_IMAGE_KEY } from "@/lib/image-config";
import { createSignedAssetUrl, downloadAssetBuffer, isInlineAssetReference } from "@/lib/bookAssets";
import type { ImagePageStatus, StoredBook } from "@/lib/types";
import {
  areAllIllustrationsReady,
  getDirectImageUrl,
  getImageStoragePath,
  getMissingIllustrationPages,
  getReadyIllustrationCount,
  hasFailedIllustrations,
  hasGeneratingIllustrations,
  isIllustrationReady,
  normalizeBookImages,
  normalizeStoredBookImages,
  type BookImagesInput,
  type NormalizedPageImage,
} from "@/lib/book-image-utils";

export * from "@/lib/book-image-utils";

export async function resolveImageDisplayUrl(image: NormalizedPageImage | null): Promise<string | null> {
  if (!image) {
    return null;
  }

  const directUrl = getDirectImageUrl(image);
  if (directUrl) {
    return directUrl;
  }

  const storagePath = getImageStoragePath(image);
  if (!storagePath) {
    return null;
  }

  if (isInlineAssetReference(storagePath)) {
    return storagePath;
  }

  return createSignedAssetUrl(storagePath, 3600);
}

export type PreviewCoverAsset = {
  status?: ImagePageStatus | string;
  assetKey?: string;
  url?: string | null;
  signedUrl?: string | null;
  storagePath?: string | null;
  generatedAt?: string | null;
};

const PREVIEW_POSTER_EXTENSIONS = ["png", "jpg", "webp"] as const;

export function isCanonicalPreviewCoverStoragePath(storagePath: string | null | undefined) {
  return Boolean(
    storagePath &&
      !storagePath.includes("page-NaN") &&
      storagePath.includes(`/preview-poster.`),
  );
}

export function isPreviewCoverReady(
  image: PreviewCoverAsset | null | undefined,
  imageStatus?: ImagePageStatus | string | null,
) {
  const storagePath = getImageStoragePath(image);
  if (!isCanonicalPreviewCoverStoragePath(storagePath)) {
    return false;
  }

  const status = image?.status ?? imageStatus;
  return status === "ready";
}

export async function findPreviewPosterStoragePath(bookId: string) {
  for (const extension of PREVIEW_POSTER_EXTENSIONS) {
    const storagePath = `books/${bookId}/preview-poster.${extension}`;
    const buffer = await downloadAssetBuffer(storagePath);
    if (buffer) {
      return storagePath;
    }
  }

  return null;
}

export function buildPreviewCoverAsset(
  storagePath: string,
  options: {
    url?: string | null;
    signedUrl?: string | null;
    generatedAt?: string | null;
  } = {},
): PreviewCoverAsset {
  return {
    status: "ready",
    assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
    storagePath,
    url: options.url ?? options.signedUrl ?? null,
    signedUrl: options.signedUrl ?? options.url ?? null,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
}

export async function resolvePreviewCoverAssetForClient(
  previewCover: PreviewCoverAsset | null | undefined,
) {
  if (!previewCover) {
    return null;
  }

  const storagePath = getImageStoragePath(previewCover);
  if (isCanonicalPreviewCoverStoragePath(storagePath)) {
    const signedUrl = await createSignedAssetUrl(storagePath!, 3600);
    return buildPreviewCoverAsset(storagePath!, {
      signedUrl,
      url: signedUrl,
      generatedAt: previewCover.generatedAt ?? null,
    });
  }

  const directUrl = getDirectImageUrl(previewCover);
  if (directUrl) {
    return {
      ...previewCover,
      assetKey: previewCover.assetKey ?? FREE_PREVIEW_POSTER_IMAGE_KEY,
      url: directUrl,
      signedUrl: directUrl,
    };
  }

  return null;
}

export function readStoredPreviewPosterImage(storedBook: StoredBook) {
  const raw = storedBook.images[FREE_PREVIEW_POSTER_IMAGE_KEY];
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const storagePath = getImageStoragePath(trimmed);
    return {
      status: storedBook.image_status[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? "ready",
      assetKey: FREE_PREVIEW_POSTER_IMAGE_KEY,
      url: storagePath ? null : trimmed,
      storagePath,
      generatedAt: null,
    };
  }

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const image = raw as PreviewCoverAsset;
    return {
      ...image,
      assetKey: image.assetKey ?? FREE_PREVIEW_POSTER_IMAGE_KEY,
    };
  }

  return null;
}

export async function resolvePreviewCoverImageForClient(
  images: Record<string, PreviewCoverAsset | undefined>,
) {
  const previewCover = images[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? images.previewCover;
  const resolvedPreviewCover = await resolvePreviewCoverAssetForClient(previewCover);
  if (!resolvedPreviewCover) {
    return images;
  }

  return {
    ...images,
    [FREE_PREVIEW_POSTER_IMAGE_KEY]: resolvedPreviewCover,
    previewCover: resolvedPreviewCover,
  };
}

export function getNormalizedImagesForStoredBook(storedBook: StoredBook) {
  const normalizedRecord = normalizeStoredBookImages(storedBook);
  const sourceBook = storedBook.full_book || storedBook.free_book;

  const input: BookImagesInput = {
    images: normalizedRecord.images,
    imageStatus: normalizedRecord.imageStatus,
    pages: sourceBook?.pages,
  };

  const images = normalizeBookImages(input);
  const posterImage = readStoredPreviewPosterImage(storedBook);
  if (posterImage) {
    const posterStatus = posterImage.status ?? storedBook.image_status[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? "not_started";
    const posterReady = isPreviewCoverReady(posterImage, posterStatus);
    images[FREE_PREVIEW_POSTER_IMAGE_KEY] = {
      status: posterReady ? "ready" : (posterStatus as ImagePageStatus),
      url: getDirectImageUrl(posterImage),
      storagePath: getImageStoragePath(posterImage),
    };
  }

  return {
    input,
    images,
    readyIllustrationCount: getReadyIllustrationCount(input),
    allIllustrationsReady: areAllIllustrationsReady(input),
    hasFailedIllustrations: hasFailedIllustrations(input),
    hasGeneratingIllustrations: hasGeneratingIllustrations(input),
    missingPages: getMissingIllustrationPages(input),
    normalizedImages: normalizedRecord.images,
    normalizedImageStatus: normalizedRecord.imageStatus,
    imagesChanged: normalizedRecord.changed,
  };
}

export async function repairStoredBookImages(storedBook: StoredBook) {
  const normalizedRecord = normalizeStoredBookImages(storedBook);
  const repairedImages = { ...normalizedRecord.images };
  const imageStatus: Record<string, ImagePageStatus> = {};

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const key = String(pageNumber);
    const image = repairedImages[key];
    if (!image || !isIllustrationReady(image)) {
      imageStatus[key] = image?.status || "not_started";
      continue;
    }

    let nextImage = image;
    if (!getDirectImageUrl(image) && getImageStoragePath(image)) {
      try {
        const signedUrl = await resolveImageDisplayUrl(image);
        nextImage = {
          ...image,
          url: signedUrl,
          status: "ready",
        };
        repairedImages[key] = nextImage;
      } catch (error) {
        console.warn("[IMAGE_REPAIR_URL_FAILED]", { pageNumber, error });
      }
    }

    imageStatus[key] = isIllustrationReady(nextImage) ? "ready" : nextImage.status || "not_started";
  }

  return {
    images: repairedImages,
    imageStatus,
    readyIllustrationCount: getReadyIllustrationCount({
      images: repairedImages,
      imageStatus,
    }),
    missingPages: getMissingIllustrationPages({
      images: repairedImages,
      imageStatus,
    }),
  };
}
