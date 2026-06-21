import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { mergeBookAssets } from "@/lib/bookStore";
import type { BookPage, ImagePageStatus, LoreBook, PageImageState, StoredBook } from "@/lib/types";

export type NormalizedPageImage = {
  pageNumber: number;
  status: ImagePageStatus;
  url: string | null;
  imageUrl?: string | null;
  src?: string | null;
  storagePath?: string | null;
};

export type BookImagesInput = {
  images?: Record<string, unknown> | unknown[] | null;
  imageStatus?: Record<string, ImagePageStatus>;
  pages?: Array<Pick<BookPage, "pageNumber" | "imageUrl">>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getImageUrl(image: unknown): string | null {
  if (!image) {
    return null;
  }

  if (typeof image === "string" && image.trim()) {
    return image.trim();
  }

  if (!isRecord(image)) {
    return null;
  }

  const candidates = [
    image.url,
    image.imageUrl,
    image.src,
    image.publicUrl,
    image.signedUrl,
    image.storagePath,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function coerceImageRecord(image: unknown, pageNumber: number): NormalizedPageImage | null {
  if (!image) {
    return null;
  }

  if (typeof image === "string") {
    return {
      pageNumber,
      status: "ready",
      url: image,
      storagePath: image.startsWith("books/") ? image : null,
    };
  }

  if (!isRecord(image)) {
    return null;
  }

  const explicitPageNumber =
    typeof image.pageNumber === "number" ? image.pageNumber : typeof image.page === "number" ? image.page : pageNumber;

  const url = getImageUrl(image);

  return {
    pageNumber: explicitPageNumber,
    status: (image.status as ImagePageStatus) || (url ? "ready" : "not_started"),
    url,
    imageUrl: typeof image.imageUrl === "string" ? image.imageUrl : null,
    src: typeof image.src === "string" ? image.src : null,
    storagePath: typeof image.storagePath === "string" ? image.storagePath : null,
  };
}

function readRawImageForPage(images: BookImagesInput["images"], pageNumber: number): unknown {
  if (!images) {
    return null;
  }

  if (Array.isArray(images)) {
    const byPageNumber = images.find((item) => {
      const record = coerceImageRecord(item, pageNumber);
      return record?.pageNumber === pageNumber;
    });

    if (byPageNumber) {
      return byPageNumber;
    }

    return images[pageNumber - 1] ?? null;
  }

  if (!isRecord(images)) {
    return null;
  }

  const oneBasedKey = String(pageNumber);
  const direct =
    images[oneBasedKey] ??
    images[pageNumber] ??
    images[`page${pageNumber}`] ??
    images[`page_${pageNumber}`];

  if (direct) {
    return direct;
  }

  const zeroBasedKey = String(pageNumber - 1);
  const zeroBased = images[zeroBasedKey];
  if (!zeroBased) {
    return null;
  }

  const coerced = coerceImageRecord(zeroBased, pageNumber);
  if (coerced?.pageNumber === pageNumber) {
    return zeroBased;
  }

  if (!isRecord(zeroBased) || zeroBased.pageNumber === undefined) {
    return zeroBased;
  }

  return null;
}

export function getImageForPage(book: BookImagesInput, pageNumber: number): NormalizedPageImage | null {
  const rawImage = readRawImageForPage(book.images, pageNumber);
  const pageFromBook = book.pages?.find((page) => page.pageNumber === pageNumber);
  const pageImageUrl = pageFromBook?.imageUrl || null;
  const coerced = coerceImageRecord(rawImage, pageNumber);
  const url = getImageUrl(coerced) || pageImageUrl || getImageUrl(rawImage);
  const storedStatus = book.imageStatus?.[String(pageNumber)];

  if (!url && !coerced && !storedStatus) {
    return null;
  }

  const normalizedStatus: ImagePageStatus = url
    ? "ready"
    : storedStatus || coerced?.status || "not_started";

  return {
    pageNumber,
    status: normalizedStatus,
    url,
    imageUrl: pageImageUrl,
    src: coerced?.src ?? null,
    storagePath:
      coerced?.storagePath ||
      (typeof rawImage === "string" && rawImage.startsWith("books/") ? rawImage : null),
  };
}

export function isIllustrationReady(image: NormalizedPageImage | null) {
  if (!image) {
    return false;
  }

  const hasUsableUrl = Boolean(getImageUrl(image));

  if (image.status === "ready" && hasUsableUrl) {
    return true;
  }

  if (!image.status && hasUsableUrl) {
    return true;
  }

  if (hasUsableUrl) {
    return true;
  }

  return false;
}

export function normalizeBookImages(book: BookImagesInput): Record<string, PageImageState> {
  const normalized: Record<string, PageImageState> = {};

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    const url = image ? getImageUrl(image) : null;

    normalized[String(pageNumber)] = image
      ? {
          status: isIllustrationReady(image) ? "ready" : image.status || "not_started",
          url,
        }
      : {
          status: "not_started",
          url: null,
        };
  }

  return normalized;
}

export function getReadyIllustrationCount(book: BookImagesInput) {
  let count = 0;

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (isIllustrationReady(image)) {
      count += 1;
    }
  }

  return count;
}

export function areAllIllustrationsReady(book: BookImagesInput) {
  return getReadyIllustrationCount(book) === FULL_BOOK_PAGE_COUNT;
}

export function hasFailedIllustrations(book: BookImagesInput) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (image?.status === "failed" && !getImageUrl(image)) {
      return true;
    }
  }

  return false;
}

export function hasGeneratingIllustrations(book: BookImagesInput) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (image?.status === "generating" && !getImageUrl(image)) {
      return true;
    }
  }

  return false;
}

export function logPdfReadyCheck(book: BookImagesInput, context = "server") {
  console.log(`[PDF_READY_CHECK] ${context} images:`, book.images);

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);

    console.log("[PDF_READY_CHECK_PAGE]", {
      pageNumber,
      image,
      status: image?.status,
      url: image?.url,
      src: image?.src,
      imageUrl: image?.imageUrl,
      storagePath: image?.storagePath,
      isReady: isIllustrationReady(image),
    });
  }

  console.log("[PDF_READY_CHECK_SUMMARY]", {
    readyCount: getReadyIllustrationCount(book),
    allReady: areAllIllustrationsReady(book),
  });
}

export async function getNormalizedImagesForStoredBook(storedBook: StoredBook) {
  const sourceBook = storedBook.full_book || storedBook.free_book;
  let pages: LoreBook["pages"] | undefined = sourceBook?.pages;

  if (sourceBook) {
    const mergedBook = await mergeBookAssets(sourceBook, storedBook.images, storedBook.audio);
    pages = mergedBook.pages;
  }

  const input: BookImagesInput = {
    images: storedBook.images,
    imageStatus: storedBook.image_status,
    pages,
  };

  return {
    input,
    images: normalizeBookImages(input),
    readyIllustrationCount: getReadyIllustrationCount(input),
    allIllustrationsReady: areAllIllustrationsReady(input),
    hasFailedIllustrations: hasFailedIllustrations(input),
    hasGeneratingIllustrations: hasGeneratingIllustrations(input),
  };
}
