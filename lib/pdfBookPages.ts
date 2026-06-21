import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import {
  createSignedAssetUrl,
  downloadAssetBuffer,
  isInlineAssetReference,
  isStorageAssetPath,
} from "@/lib/bookAssets";
import { getImageForPage, getImageUrl, type BookImagesInput } from "@/lib/book-images";
import type { ImagePageStatus, LoreBook } from "@/lib/types";

export type PdfStoryPage = {
  pageNumber: number;
  title: string;
  text: string;
  imageSrc: string | null;
};

export type PdfGenerationContext = {
  images?: Record<string, string>;
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
      const rawUrl = getImageUrl(image) || page.imageUrl || null;
      let imageSrc: string | null = null;

      if (rawUrl) {
        try {
          imageSrc = await resolveRenderableImageSrc(rawUrl);
        } catch (error) {
          console.warn(`[PDF_IMAGE_RESOLVE_FAILED] page ${page.pageNumber}`, error);
          imageSrc = null;
        }
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
