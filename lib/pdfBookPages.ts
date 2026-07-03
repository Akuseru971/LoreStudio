import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import {
  createSignedAssetUrl,
  downloadAssetBuffer,
  isInlineAssetReference,
  isStorageAssetPath,
} from "@/lib/bookAssets";
import {
  getDirectImageUrl,
  getImageForPage,
  getImageStoragePath,
  logPdfImageCheck,
  readStoredPreviewPosterImage,
  resolveImageDisplayUrl,
  type BookImagesInput,
} from "@/lib/book-images";
import { FREE_PREVIEW_POSTER_IMAGE_KEY } from "@/lib/image-config";
import type { BookPageImage, ImagePageStatus, LoreBook, StoredBook } from "@/lib/types";
import { normalizeStoredBookImages } from "@/lib/book-image-utils";

export type PdfStoryPage = {
  pageNumber: number;
  title: string;
  text: string;
  imageSrc: string | null;
};

export type PdfGenerationContext = {
  images?: Record<string, BookPageImage | string>;
  imageStatus?: Record<string, ImagePageStatus>;
  allImages?: Record<string, BookPageImage | string>;
  bookId?: string;
  previewCover?: unknown;
};

const PREVIEW_POSTER_EXTENSIONS = ["png", "jpg", "webp"] as const;

function mimeTypeForStoragePath(path: string) {
  if (path.includes(".png")) {
    return "image/png";
  }
  if (path.includes(".webp")) {
    return "image/webp";
  }
  return "image/jpeg";
}

function isInvalidPreviewCoverStoragePath(storagePath: string | null | undefined) {
  return !storagePath || storagePath.includes("page-NaN");
}

function normalizePreviewCoverRecord(raw: unknown) {
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
      pageNumber: 0,
      status: "ready" as const,
      url: storagePath ? null : trimmed,
      storagePath,
      generatedAt: null,
      startedAt: null,
      updatedAt: null,
      generationStartedAt: null,
      generationClaimId: null,
    };
  }

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const image = raw as BookPageImage;
    return {
      pageNumber: 0,
      status: image.status || "ready",
      url: getDirectImageUrl(image),
      storagePath: getImageStoragePath(image),
      generatedAt: image.generatedAt || null,
      startedAt: image.startedAt || null,
      updatedAt: image.updatedAt || null,
      generationStartedAt: image.generationStartedAt || null,
      generationClaimId: image.generationClaimId || null,
    };
  }

  return null;
}

function readPreviewCoverImage(context: PdfGenerationContext) {
  if (context.previewCover) {
    return normalizePreviewCoverRecord(context.previewCover);
  }

  const source = context.allImages ?? context.images;
  if (!source) {
    return null;
  }

  const raw = source[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? source.previewCover;
  return normalizePreviewCoverRecord(raw);
}

async function resolveFallbackPreviewPosterStoragePath(bookId: string | undefined) {
  if (!bookId) {
    return null;
  }

  for (const extension of PREVIEW_POSTER_EXTENSIONS) {
    const storagePath = `books/${bookId}/preview-poster.${extension}`;
    const buffer = await downloadAssetBuffer(storagePath);
    if (buffer) {
      return storagePath;
    }
  }

  return null;
}

export async function resolveRenderableImageSrc(url: string): Promise<string | null> {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (isInlineAssetReference(trimmed)) {
    return trimmed;
  }

  if (isStorageAssetPath(trimmed)) {
    const buffer = await downloadAssetBuffer(trimmed);
    if (buffer) {
      const mimeType = mimeTypeForStoragePath(trimmed);
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    return createSignedAssetUrl(trimmed);
  }

  return trimmed;
}

export async function resolveImageUrlForPdf(image: Awaited<ReturnType<typeof getImageForPage>>) {
  if (!image) {
    return null;
  }

  logPdfImageCheck(image.pageNumber, image);

  const displayUrl = await resolveImageDisplayUrl(image);
  if (displayUrl) {
    return resolveRenderableImageSrc(displayUrl);
  }

  return null;
}

async function resolvePreviewCoverDisplayUrlForPdf(
  previewCover: NonNullable<ReturnType<typeof readPreviewCoverImage>>,
  bookId?: string,
) {
  const storagePath = getImageStoragePath(previewCover);
  if (!isInvalidPreviewCoverStoragePath(storagePath) && storagePath && isStorageAssetPath(storagePath)) {
    console.log("[PDF_PREVIEW_COVER_FOUND]", { storagePath, source: "stored_asset" });
    const signedUrl = await createSignedAssetUrl(storagePath, 3600);
    console.log("[PDF_PREVIEW_COVER_SIGNED_URL_READY]", { storagePath });
    return signedUrl;
  }

  const fallbackStoragePath = await resolveFallbackPreviewPosterStoragePath(bookId);
  if (fallbackStoragePath) {
    console.log("[PDF_PREVIEW_COVER_FOUND]", { storagePath: fallbackStoragePath, source: "storage_fallback" });
    const signedUrl = await createSignedAssetUrl(fallbackStoragePath, 3600);
    console.log("[PDF_PREVIEW_COVER_SIGNED_URL_READY]", { storagePath: fallbackStoragePath });
    return signedUrl;
  }

  const directUrl = getDirectImageUrl(previewCover);
  if (directUrl) {
    console.log("[PDF_PREVIEW_COVER_FOUND]", { source: "direct_url" });
    return directUrl;
  }

  const displayUrl = await resolveImageDisplayUrl(previewCover);
  if (displayUrl) {
    console.log("[PDF_PREVIEW_COVER_FOUND]", { source: "resolved_display_url" });
    return displayUrl;
  }

  return null;
}

export async function resolvePreviewCoverUrlForPdf(
  context: PdfGenerationContext = {},
): Promise<string | null> {
  const previewCover = readPreviewCoverImage(context);
  if (!previewCover) {
    console.warn("[PDF_PREVIEW_COVER_NOT_AVAILABLE_FOR_THIS_BOOK]", {
      bookId: context.bookId ?? null,
    });
    return null;
  }

  if (isInvalidPreviewCoverStoragePath(getImageStoragePath(previewCover)) && !getDirectImageUrl(previewCover)) {
    const fallbackStoragePath = await resolveFallbackPreviewPosterStoragePath(context.bookId);
    if (!fallbackStoragePath) {
      console.warn("[PDF_PREVIEW_COVER_NOT_AVAILABLE_FOR_THIS_BOOK]", {
        bookId: context.bookId ?? null,
        reason: "invalid_or_missing_storage_path",
      });
      return null;
    }
  }

  try {
    const displayUrl = await resolvePreviewCoverDisplayUrlForPdf(previewCover, context.bookId);
    if (!displayUrl) {
      console.warn("[PDF_PREVIEW_COVER_NOT_AVAILABLE_FOR_THIS_BOOK]", {
        bookId: context.bookId ?? null,
        reason: "unresolved_display_url",
      });
      return null;
    }

    return resolveRenderableImageSrc(displayUrl);
  } catch (error) {
    console.warn("[PDF_PREVIEW_COVER_RESOLVE_FAILED]", error);
    return null;
  }
}

export function buildPdfGenerationContext(
  storedBook: StoredBook,
  normalized?: ReturnType<typeof normalizeStoredBookImages>,
) {
  const normalizedRecord = normalized ?? normalizeStoredBookImages(storedBook);
  const previewCover = readStoredPreviewPosterImage(storedBook);

  return {
    images: normalizedRecord.images,
    imageStatus: normalizedRecord.imageStatus,
    allImages: storedBook.images,
    bookId: storedBook.id,
    previewCover,
  };
}

export function countPdfPages(buffer: Buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

export async function pdfNeedsPreviewCoverRecovery(
  pdfStoragePath: string,
  coverImageSrc: string | null,
) {
  if (!coverImageSrc) {
    return false;
  }

  const { downloadBookPdf } = await import("@/lib/bookStore");
  const buffer = await downloadBookPdf(pdfStoragePath);
  const pageCount = countPdfPages(buffer);
  const expectedWithCover = FULL_BOOK_PAGE_COUNT * 2 + 1;
  const expectedWithoutCover = FULL_BOOK_PAGE_COUNT * 2;

  return pageCount <= expectedWithoutCover && pageCount < expectedWithCover;
}

export async function preparePdfStoryPages(
  book: LoreBook,
  context: PdfGenerationContext = {},
): Promise<PdfStoryPage[]> {
  const imagesInput: BookImagesInput = {
    images: context.images,
    imageStatus: context.imageStatus,
    pages: book.pages,
  };

  const storyPages = book.pages.slice(0, FULL_BOOK_PAGE_COUNT);

  return Promise.all(
    storyPages.map(async (page) => {
      const image = getImageForPage(imagesInput, page.pageNumber);
      let imageSrc: string | null = null;

      try {
        imageSrc = await resolveImageUrlForPdf(image);
      } catch (error) {
        console.warn(`[PDF_IMAGE_RESOLVE_FAILED] page ${page.pageNumber}`, error);
        imageSrc = null;
      }

      if (!imageSrc) {
        console.warn("[PDF_IMAGE_MISSING]", { pageNumber: page.pageNumber, image });
      }

      return {
        pageNumber: page.pageNumber,
        title: page.title,
        text: page.text,
        imageSrc,
      };
    }),
  );
}
