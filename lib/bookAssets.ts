import { BOOK_ASSETS_BUCKET, getSupabaseServerClient } from "@/lib/supabase/server";

export type BookAssetType = "image" | "audio";

function requireSupabase() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

export function isInlineAssetReference(value: string) {
  return value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://");
}

export function isStorageAssetPath(value: string) {
  return value.startsWith("books/");
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
  const extension = extensionForMime(mimeType, assetType);
  return `books/${bookId}/page-${pageNumber}-${assetType}.${extension}`;
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

  if (!assetRef.startsWith("data:")) {
    return assetRef;
  }

  const parsed = parseDataUrl(assetRef);
  if (!parsed) {
    throw new Error("Invalid asset payload.");
  }

  const supabase = requireSupabase();
  const storagePath = buildAssetStoragePath(bookId, pageNumber, assetType, parsed.mimeType);
  const { error } = await supabase.storage.from(BOOK_ASSETS_BUCKET).upload(storagePath, parsed.buffer, {
    contentType: parsed.mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function createSignedAssetUrl(assetRef: string, expiresInSeconds = 3600) {
  if (!assetRef || isInlineAssetReference(assetRef)) {
    return assetRef;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from(BOOK_ASSETS_BUCKET)
    .createSignedUrl(assetRef, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create a signed asset URL.");
  }

  return data.signedUrl;
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
