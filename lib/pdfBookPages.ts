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
  resolveImageDisplayUrl,
  type BookImagesInput,
} from "@/lib/book-images";
import { FREE_PREVIEW_POSTER_IMAGE_KEY } from "@/lib/image-config";
import type { BookPageImage, ImagePageStatus, LoreBook } from "@/lib/types";

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
};

function mimeTypeForStoragePath(path: string) {
  if (path.includes(".png")) {
    return "image/png";
  }
  if (path.includes(".webp")) {
    return "image/webp";
  }
  return "image/jpeg";
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

function readPreviewCoverImage(context: PdfGenerationContext) {
  const source = context.allImages ?? context.images;
  if (!source) {
    return null;
  }

  const raw = source[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? source.previewCover;
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

export async function resolvePreviewCoverUrlForPdf(
  context: PdfGenerationContext = {},
): Promise<string | null> {
  const previewCover = readPreviewCoverImage(context);
  if (!previewCover) {
    console.warn("[PDF_PREVIEW_COVER_MISSING]");
    return null;
  }

  console.log("[PDF_PREVIEW_COVER_CHECK]", {
    storagePath: previewCover.storagePath,
    url: previewCover.url,
  });

  try {
    const displayUrl = await resolveImageDisplayUrl(previewCover);
    if (!displayUrl) {
      console.warn("[PDF_PREVIEW_COVER_UNRESOLVED]", previewCover);
      return null;
    }

    return resolveRenderableImageSrc(displayUrl);
  } catch (error) {
    console.warn("[PDF_PREVIEW_COVER_RESOLVE_FAILED]", error);
    return null;
  }
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
