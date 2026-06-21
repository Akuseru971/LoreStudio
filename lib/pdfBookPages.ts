import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import {
  createSignedAssetUrl,
  downloadAssetBuffer,
  isInlineAssetReference,
  isStorageAssetPath,
} from "@/lib/bookAssets";
import {
  getImageForPage,
  logPdfImageCheck,
  resolveImageDisplayUrl,
  type BookImagesInput,
} from "@/lib/book-images";
import type { BookPageImage, ImagePageStatus, LoreBook } from "@/lib/types";

export type PdfStoryPage = {
  pageNumber: number;
  title: string;
  text: string;
  imageSrc: string | null;
};

/** Image frame height (pt) — larger when body text is shorter. Never below 420. */
export function getImageHeightForPage(textLength: number): number {
  if (textLength <= 280) {
    return 500;
  }

  if (textLength <= 420) {
    return 460;
  }

  return 420;
}

export type PdfGenerationContext = {
  images?: Record<string, BookPageImage | string>;
  imageStatus?: Record<string, ImagePageStatus>;
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
