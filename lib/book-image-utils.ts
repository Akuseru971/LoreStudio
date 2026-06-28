import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import type { BookPage, BookPageImage, ImagePageStatus, PageImageState, StoredBook } from "@/lib/types";

export type NormalizedPageImage = BookPageImage & {
  imageUrl?: string | null;
  src?: string | null;
};

export type BookImagesInput = {
  images?: Record<string, unknown> | unknown[] | null;
  imageStatus?: Record<string, ImagePageStatus>;
  pages?: Array<Pick<BookPage, "pageNumber" | "imageUrl">>;
};

export type NormalizedBookImages = {
  images: Record<string, BookPageImage>;
  imageStatus: Record<string, ImagePageStatus>;
  changed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStorageAssetPath(value: string) {
  return value.startsWith("books/");
}

export function getImageStoragePath(image: unknown): string | null {
  if (typeof image === "string" && isStorageAssetPath(image)) {
    return image;
  }

  if (!isRecord(image)) {
    return null;
  }

  if (typeof image.storagePath === "string" && image.storagePath.trim()) {
    return image.storagePath.trim();
  }

  return null;
}

export function getDirectImageUrl(image: unknown): string | null {
  if (!image) {
    return null;
  }

  if (typeof image === "string") {
    const trimmed = image.trim();
    if (!trimmed || isStorageAssetPath(trimmed)) {
      return null;
    }
    return trimmed;
  }

  if (!isRecord(image)) {
    return null;
  }

  const candidates = [image.url, image.imageUrl, image.src, image.publicUrl, image.signedUrl, image.storageUrl];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !isStorageAssetPath(candidate.trim())) {
      return candidate.trim();
    }
  }

  return null;
}

export function getImageUrl(image: unknown): string | null {
  return getDirectImageUrl(image) || getImageStoragePath(image);
}

function coerceCanonicalImage(image: unknown, pageNumber: number): BookPageImage | null {
  if (!image) {
    return null;
  }

  if (typeof image === "string") {
    const trimmed = image.trim();
    if (!trimmed) {
      return null;
    }

    if (isStorageAssetPath(trimmed)) {
      return {
        pageNumber,
        status: "ready",
        storagePath: trimmed,
        url: null,
      };
    }

    return {
      pageNumber,
      status: "ready",
      url: trimmed,
      storagePath: null,
      generatedAt: null,
    };
  }

  if (!isRecord(image)) {
    return null;
  }

  const explicitPageNumber =
    typeof image.pageNumber === "number" ? image.pageNumber : typeof image.page === "number" ? image.page : pageNumber;

  const storagePath = getImageStoragePath(image);
  const directUrl = getDirectImageUrl(image);
  const usable = Boolean(storagePath || directUrl);
  const rawStatus = (image.status as ImagePageStatus) || (usable ? "ready" : "not_started");
  const status: ImagePageStatus =
    rawStatus === "ready" && !usable ? "not_started" : usable ? "ready" : rawStatus;

  return {
    pageNumber: explicitPageNumber,
    status,
    url: directUrl,
    storagePath,
    generatedAt: typeof image.generatedAt === "string" ? image.generatedAt : null,
    startedAt: typeof image.startedAt === "string" ? image.startedAt : null,
    updatedAt: typeof image.updatedAt === "string" ? image.updatedAt : null,
    generationStartedAt:
      typeof image.generationStartedAt === "string" ? image.generationStartedAt : null,
    generationClaimId:
      typeof image.generationClaimId === "string" ? image.generationClaimId : null,
  };
}

function readRawImageForPage(images: BookImagesInput["images"], pageNumber: number): unknown {
  if (!images) {
    return null;
  }

  if (Array.isArray(images)) {
    const byPageNumber = images.find((item) => {
      const record = coerceCanonicalImage(item, pageNumber);
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
    images[oneBasedKey] ?? images[pageNumber] ?? images[`page${pageNumber}`] ?? images[`page_${pageNumber}`];

  if (direct) {
    return direct;
  }

  const zeroBasedKey = String(pageNumber - 1);
  const zeroBased = images[zeroBasedKey];
  if (!zeroBased) {
    return null;
  }

  const coerced = coerceCanonicalImage(zeroBased, pageNumber);
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
  const coerced = coerceCanonicalImage(rawImage, pageNumber);
  const pageCoerced = pageImageUrl ? coerceCanonicalImage(pageImageUrl, pageNumber) : null;
  const mergedUrl = getDirectImageUrl(coerced) || getDirectImageUrl(pageCoerced) || getDirectImageUrl(pageImageUrl);
  const mergedStoragePath = getImageStoragePath(coerced) || getImageStoragePath(pageCoerced);
  const storedStatus = book.imageStatus?.[String(pageNumber)];
  const usable = Boolean(mergedUrl || mergedStoragePath);

  if (!usable && !coerced && !pageCoerced && !storedStatus) {
    return null;
  }

  const status: ImagePageStatus = usable
    ? "ready"
    : storedStatus || coerced?.status || pageCoerced?.status || "not_started";

  return {
    pageNumber,
    status: status === "ready" && !usable ? "not_started" : status,
    url: mergedUrl,
    storagePath: mergedStoragePath,
    generatedAt: coerced?.generatedAt || pageCoerced?.generatedAt || null,
    startedAt: coerced?.startedAt || pageCoerced?.startedAt || null,
    updatedAt: coerced?.updatedAt || pageCoerced?.updatedAt || null,
    generationStartedAt: coerced?.generationStartedAt || pageCoerced?.generationStartedAt || null,
    generationClaimId: coerced?.generationClaimId || pageCoerced?.generationClaimId || null,
    imageUrl: pageImageUrl,
    src: coerced?.url ?? null,
  };
}

export function isIllustrationReady(image: NormalizedPageImage | BookPageImage | null) {
  if (!image) {
    return false;
  }

  if (getImageStoragePath(image)) {
    return true;
  }

  const directUrl = getDirectImageUrl(image);
  if (directUrl) {
    return true;
  }

  return false;
}

export function mergeUpdatedImage(
  currentImages: Record<string, BookPageImage>,
  pageNumber: number,
  imageData: BookPageImage,
): Record<string, BookPageImage> {
  return {
    ...currentImages,
    [String(pageNumber)]: {
      ...currentImages[String(pageNumber)],
      ...imageData,
      pageNumber,
    },
  };
}

export function normalizeBookImages(book: BookImagesInput): Record<string, PageImageState> {
  const normalized: Record<string, PageImageState> = {};

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    const url = image ? getDirectImageUrl(image) : null;
    const storagePath = image ? getImageStoragePath(image) : null;

    normalized[String(pageNumber)] = image
      ? {
          status: isIllustrationReady(image) ? "ready" : image.status || "not_started",
          url,
          storagePath,
        }
      : {
          status: "not_started",
          url: null,
          storagePath: null,
        };
  }

  return normalized;
}

export function normalizeStoredBookImages(storedBook: Pick<StoredBook, "images" | "image_status" | "free_book" | "full_book">): NormalizedBookImages {
  const sourceBook = storedBook.full_book || storedBook.free_book;
  const pages = sourceBook?.pages;

  const images: Record<string, BookPageImage> = {};
  const imageStatus: Record<string, ImagePageStatus> = {};
  let changed = false;

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const key = String(pageNumber);
    const image = getImageForPage(
      {
        images: storedBook.images,
        imageStatus: storedBook.image_status,
        pages,
      },
      pageNumber,
    );

    const raw = readRawImageForPage(storedBook.images, pageNumber);
    const rawWasString = typeof raw === "string";
    const rawWasLegacyKey = isRecord(storedBook.images) && raw !== storedBook.images[key];

    if (!image) {
      const raw = readRawImageForPage(storedBook.images, pageNumber);
      const rawRecord = raw && typeof raw === "object" && raw !== null ? (raw as BookPageImage) : null;
      images[key] = {
        pageNumber,
        status: storedBook.image_status[key] || "not_started",
        url: null,
        storagePath: null,
        generatedAt: rawRecord?.generatedAt || null,
        startedAt: rawRecord?.startedAt || null,
        updatedAt: rawRecord?.updatedAt || null,
        generationStartedAt: rawRecord?.generationStartedAt || null,
        generationClaimId: rawRecord?.generationClaimId || null,
      };
      imageStatus[key] = images[key].status;
      continue;
    }

    const canonical: BookPageImage = {
      pageNumber,
      status: isIllustrationReady(image) ? "ready" : image.status || "not_started",
      url: getDirectImageUrl(image),
      storagePath: getImageStoragePath(image),
      generatedAt: image.generatedAt || null,
      startedAt: image.startedAt || null,
      updatedAt: image.updatedAt || null,
      generationStartedAt: image.generationStartedAt || null,
      generationClaimId:
        image.generationClaimId ||
        (isRecord(raw) && typeof raw.generationClaimId === "string" ? raw.generationClaimId : null) ||
        null,
    };

    images[key] = canonical;
    imageStatus[key] = canonical.status;

    if (rawWasString || rawWasLegacyKey || canonical.status !== storedBook.image_status[key]) {
      changed = true;
    }
  }

  return { images, imageStatus, changed };
}

export function mergeNormalizedImagesPreservingGenerationClaims(
  storedBook: Pick<StoredBook, "images" | "image_status">,
  images: Record<string, BookPageImage>,
  imageStatus: Record<string, ImagePageStatus>,
) {
  const preservedImages = { ...images };
  const preservedStatus = { ...imageStatus };

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const key = String(pageNumber);
    const raw = readRawImageForPage(storedBook.images, pageNumber);
    if (!isRecord(raw)) {
      continue;
    }

    const rawStatus = storedBook.image_status[key];
    const normalizedStatus = preservedStatus[key] || preservedImages[key]?.status;
    if (rawStatus !== "generating" && normalizedStatus !== "generating") {
      continue;
    }

    preservedImages[key] = {
      ...preservedImages[key],
      pageNumber,
      status: "generating",
      generationClaimId:
        (typeof raw.generationClaimId === "string" ? raw.generationClaimId : null) ||
        preservedImages[key]?.generationClaimId ||
        null,
      startedAt:
        (typeof raw.startedAt === "string" ? raw.startedAt : null) ||
        preservedImages[key]?.startedAt ||
        null,
      updatedAt:
        (typeof raw.updatedAt === "string" ? raw.updatedAt : null) ||
        preservedImages[key]?.updatedAt ||
        null,
      generationStartedAt:
        (typeof raw.generationStartedAt === "string" ? raw.generationStartedAt : null) ||
        preservedImages[key]?.generationStartedAt ||
        null,
    };
    preservedStatus[key] = "generating";
  }

  return { images: preservedImages, imageStatus: preservedStatus };
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

export function getMissingIllustrationPages(book: BookImagesInput) {
  const missing: number[] = [];

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (!isIllustrationReady(image)) {
      missing.push(pageNumber);
    }
  }

  return missing;
}

export function hasFailedIllustrations(book: BookImagesInput) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (image?.status === "failed" && !isIllustrationReady(image)) {
      return true;
    }
  }

  return false;
}

export function hasGeneratingIllustrations(book: BookImagesInput) {
  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    if (image?.status === "generating" && !isIllustrationReady(image)) {
      return true;
    }
  }

  return false;
}

export function logBookImageRender(pageNumber: number, image: NormalizedPageImage | null, context = "client") {
  console.log("[BOOK_IMAGE_RENDER]", {
    context,
    pageNumber,
    image,
    imageUrl: image ? getDirectImageUrl(image) : null,
    storagePath: image ? getImageStoragePath(image) : null,
    ready: isIllustrationReady(image),
  });
}

export function logPdfImageCheck(pageNumber: number, image: NormalizedPageImage | null) {
  console.log("[PDF_IMAGE_CHECK]", {
    pageNumber,
    image,
    imageUrl: image ? getDirectImageUrl(image) : null,
    storagePath: image ? getImageStoragePath(image) : null,
    ready: isIllustrationReady(image),
  });
}

export function logPdfReadyCheck(book: BookImagesInput, context = "server") {
  console.log(`[PDF_READY_CHECK] ${context} images:`, book.images);

  for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const image = getImageForPage(book, pageNumber);
    logPdfImageCheck(pageNumber, image);
  }

  console.log("[PDF_READY_CHECK_SUMMARY]", {
    readyCount: getReadyIllustrationCount(book),
    allReady: areAllIllustrationsReady(book),
    missingPages: getMissingIllustrationPages(book),
  });
}
