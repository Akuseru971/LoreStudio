import "server-only";

import { BOOK_ASSETS_BUCKET, getSupabaseServerClient } from "@/lib/supabase/server";
import { isStorageAssetPath as isBookStorageAssetPath } from "@/lib/book-image-utils";
import { safeFetch } from "@/lib/server/safe-fetch";
import { withRetry } from "@/lib/server/with-retry";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BookAssetType = "image" | "audio";

const BOOK_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/mp3"];
const BOOK_ASSET_SIZE_LIMIT = 10 * 1024 * 1024;

let ensureBucketPromise: Promise<void> | null = null;

function requireSupabase() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

async function ensureBookAssetsBucket(supabase: SupabaseClient) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(BOOK_ASSETS_BUCKET);
  if (!getError && bucket) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BOOK_ASSETS_BUCKET, {
    public: false,
    fileSizeLimit: BOOK_ASSET_SIZE_LIMIT,
    allowedMimeTypes: BOOK_ASSET_MIME_TYPES,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message);
  }
}

function ensureBookAssetsBucketReady(supabase: SupabaseClient) {
  if (!ensureBucketPromise) {
    ensureBucketPromise = ensureBookAssetsBucket(supabase).catch((error) => {
      ensureBucketPromise = null;
      throw error;
    });
  }

  return ensureBucketPromise;
}

export function isInlineAssetReference(value: string) {
  return value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://");
}

export function isStorageAssetPath(value: string) {
  return isBookStorageAssetPath(value);
}

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionForMime(mimeType: string, assetType: BookAssetType) {
  if (mimeType.includes("png")) {
    return "png";
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }
  return assetType === "image" ? "png" : "mp3";
}

export function buildAssetStoragePath(
  bookId: string,
  pageNumber: number,
  assetType: BookAssetType,
  mimeType: string,
) {
  if (assetType === "image") {
    return buildImageStoragePath(bookId, pageNumber);
  }

  const extension = extensionForMime(mimeType, assetType);
  return `books/${bookId}/page-${pageNumber}-${assetType}.${extension}`;
}

export function buildImageStoragePath(bookId: string, pageNumber: number) {
  return `books/${bookId}/images/page-${pageNumber}.png`;
}

async function uploadBufferToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
  meta: Record<string, unknown>,
) {
  const supabase = requireSupabase();
  await ensureBookAssetsBucketReady(supabase);

  const uploadOnce = async () => {
    const { error } = await supabase.storage.from(BOOK_ASSETS_BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("[SUPABASE_UPLOAD_ERROR]", {
        ...meta,
        storagePath,
        message: error.message,
      });
      throw new Error(error.message);
    }
  };

  try {
    await uploadOnce();
  } catch (error) {
    if (error instanceof Error && /bucket not found/i.test(error.message)) {
      ensureBucketPromise = null;
      await ensureBookAssetsBucketReady(supabase);
      await uploadOnce();
    } else {
      throw error;
    }
  }

  return storagePath;
}

export async function uploadBookAsset(
  bookId: string,
  pageNumber: number,
  assetType: BookAssetType,
  assetRef: string,
) {
  if (isStorageAssetPath(assetRef)) {
    return assetRef;
  }

  if (assetRef.startsWith("http://") || assetRef.startsWith("https://")) {
    console.log("[IMAGE_DOWNLOAD_START]", {
      pageNumber,
      imageUrlPreview: assetRef.slice(0, 120),
    });

    const response = await withRetry(
      () => safeFetch(assetRef, {}, { pageNumber, step: "image_download", bookId }),
      { pageNumber, step: "image_download", bookId },
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    const storagePath = buildAssetStoragePath(bookId, pageNumber, assetType, contentType);

    console.log("[IMAGE_DOWNLOAD_SUCCESS]", { pageNumber, bytes: buffer.length });
    console.log("[SUPABASE_IMAGE_UPLOAD_START]", { pageNumber, storagePath });

    const uploadedPath = await withRetry(
      () => uploadBufferToStorage(storagePath, buffer, contentType, { pageNumber, bookId }),
      { pageNumber, step: "supabase_upload", bookId },
    );

    console.log("[SUPABASE_IMAGE_UPLOAD_SUCCESS]", { pageNumber, storagePath: uploadedPath });
    return uploadedPath;
  }

  if (!assetRef.startsWith("data:")) {
    throw new Error(`Unsupported asset reference for page ${pageNumber}.`);
  }

  const parsed = parseDataUrl(assetRef);
  if (!parsed) {
    throw new Error("Invalid asset payload.");
  }

  const storagePath = buildAssetStoragePath(bookId, pageNumber, assetType, parsed.mimeType);
  console.log("[SUPABASE_IMAGE_UPLOAD_START]", { pageNumber, storagePath });

  const uploadedPath = await withRetry(
    () => uploadBufferToStorage(storagePath, parsed.buffer, parsed.mimeType, { pageNumber, bookId }),
    { pageNumber, step: "supabase_upload", bookId },
  );

  console.log("[SUPABASE_IMAGE_UPLOAD_SUCCESS]", { pageNumber, storagePath: uploadedPath });
  return uploadedPath;
}

export async function createSignedAssetUrl(assetRef: string, expiresInSeconds = 3600) {
  if (!assetRef || isInlineAssetReference(assetRef)) {
    return assetRef;
  }

  const supabase = requireSupabase();
  await ensureBookAssetsBucketReady(supabase);
  const { data, error } = await supabase.storage
    .from(BOOK_ASSETS_BUCKET)
    .createSignedUrl(assetRef, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create a signed asset URL.");
  }

  return data.signedUrl;
}

export async function downloadAssetBuffer(assetRef: string) {
  if (!assetRef) {
    return null;
  }

  if (assetRef.startsWith("data:")) {
    const parsed = parseDataUrl(assetRef);
    return parsed?.buffer ?? null;
  }

  if (!isStorageAssetPath(assetRef)) {
    return null;
  }

  const supabase = requireSupabase();
  await ensureBookAssetsBucketReady(supabase);
  const { data, error } = await supabase.storage.from(BOOK_ASSETS_BUCKET).download(assetRef);
  if (error || !data) {
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function resolveAssetMap(assets: Record<string, string>) {
  const entries = await Promise.all(
    Object.entries(assets).map(async ([pageNumber, assetRef]) => {
      if (!assetRef) {
        return [pageNumber, assetRef] as const;
      }
      return [pageNumber, await createSignedAssetUrl(assetRef)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function persistAssetMap(
  bookId: string,
  assets: Record<string, string>,
  assetType: BookAssetType,
) {
  const persisted: Record<string, string> = {};

  for (const [pageNumber, assetRef] of Object.entries(assets)) {
    if (!assetRef) {
      continue;
    }
    persisted[pageNumber] = await uploadBookAsset(bookId, Number(pageNumber), assetType, assetRef);
  }

  return persisted;
}
