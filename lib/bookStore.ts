import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { generateAccessToken } from "@/lib/accessToken";
import { persistAssetMap, resolveAssetMap } from "@/lib/bookAssets";
import { BOOK_AUDIO_BUCKET, BOOK_PDF_BUCKET, getSupabaseServerClient } from "@/lib/supabase/server";
import type { BookFormInput, BookPage, BookStatus, ConfirmationEmailStatus, ImagePageStatus, LoreBook, Mp3Status, PdfStatus, StoredBook } from "@/lib/types";
import { createDefaultImageStatusMap } from "@/lib/imageStatus";
import { stripBookAssets } from "@/lib/utils";

const BOOKS_TABLE = "books";

function requireSupabase() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

function mapRow(row: Record<string, unknown>): StoredBook {
  return {
    id: String(row.id),
    access_token: String(row.access_token),
    email: row.email ? String(row.email) : null,
    status: row.status as BookStatus,
    form_input: row.form_input as BookFormInput,
    free_book: (row.free_book as LoreBook | null) ?? null,
    full_book: (row.full_book as LoreBook | null) ?? null,
    free_pages: (row.free_pages as BookPage[] | null) ?? null,
    premium_pages: (row.premium_pages as BookPage[] | null) ?? null,
    images: (row.images as Record<string, string>) ?? {},
    image_status: (row.image_status as Record<string, ImagePageStatus>) ?? {},
    audio: (row.audio as Record<string, string>) ?? {},
    pdf_url: row.pdf_url ? String(row.pdf_url) : null,
    pdf_storage_path: row.pdf_storage_path ? String(row.pdf_storage_path) : null,
    pdf_status: (row.pdf_status as PdfStatus | null) ?? (row.pdf_storage_path ? "ready" : "not_started"),
    pdf_generated_at: row.pdf_generated_at ? String(row.pdf_generated_at) : null,
    mp3_storage_path: row.mp3_storage_path ? String(row.mp3_storage_path) : null,
    mp3_generated_at: row.mp3_generated_at ? String(row.mp3_generated_at) : null,
    mp3_status: (row.mp3_status as Mp3Status | null) ?? "not_started",
    stripe_session_id: row.stripe_session_id ? String(row.stripe_session_id) : null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ? String(row.stripe_payment_intent_id) : null,
    confirmation_email_sent_at: row.confirmation_email_sent_at ? String(row.confirmation_email_sent_at) : null,
    confirmation_email_status: (row.confirmation_email_status as ConfirmationEmailStatus | null) ?? "not_started",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function splitFreeAndPremiumPages(book: LoreBook) {
  const freePages = book.pages.slice(0, ILLUSTRATED_PAGE_COUNT);
  const premiumPages = book.pages.slice(ILLUSTRATED_PAGE_COUNT);
  return { freePages, premiumPages };
}

function buildAssetMaps(book: LoreBook) {
  const images: Record<string, string> = {};
  const audio: Record<string, string> = {};

  for (const page of book.pages) {
    if (page.imageUrl) {
      images[String(page.pageNumber)] = page.imageUrl;
    }
    if (page.audioUrl) {
      audio[String(page.pageNumber)] = page.audioUrl;
    }
  }

  return { images, audio };
}

export async function createFreeBook(formInput: BookFormInput, book: LoreBook) {
  const supabase = requireSupabase();
  const accessToken = generateAccessToken();
  const leanBook = stripBookAssets(book);
  const { freePages, premiumPages } = splitFreeAndPremiumPages(leanBook);

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .insert({
      access_token: accessToken,
      status: "free",
      form_input: formInput,
      free_book: leanBook,
      free_pages: freePages,
      premium_pages: premiumPages,
      images: {},
      image_status: createDefaultImageStatusMap(),
      audio: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save the free book.");
  }

  return mapRow(data);
}

export async function saveBookAsset(
  accessToken: string,
  pageNumber: number,
  assetType: "image" | "audio",
  assetRef: string,
) {
  const supabase = requireSupabase();
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const storagePath = await persistAssetMap(
    storedBook.id,
    { [String(pageNumber)]: assetRef },
    assetType,
  );
  const persistedRef = storagePath[String(pageNumber)];
  if (!persistedRef) {
    throw new Error("Unable to persist book asset.");
  }

  const column = assetType === "image" ? "images" : "audio";
  const nextAssets = {
    ...storedBook[column],
    [String(pageNumber)]: persistedRef,
  };
  const nextImageStatus =
    assetType === "image"
      ? {
          ...storedBook.image_status,
          [String(pageNumber)]: "ready" as ImagePageStatus,
        }
      : storedBook.image_status;

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      [column]: nextAssets,
      ...(assetType === "image" ? { image_status: nextImageStatus } : {}),
    })
    .eq("id", storedBook.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save book asset.");
  }

  return mapRow(data);
}

export async function getBookById(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from(BOOKS_TABLE).select("*").eq("id", bookId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapRow(data) : null;
}

export async function getBookByAccessToken(accessToken: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function updateBookStatus(bookId: string, status: BookStatus) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ status })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update book status.");
  }

  return mapRow(data);
}

export async function saveStripeSession(
  bookId: string,
  stripeSessionId: string,
  status: BookStatus = "checkout_started",
) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      status,
      stripe_session_id: stripeSessionId,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save Stripe session.");
  }

  return mapRow(data);
}

export async function saveFullBook(
  bookId: string,
  fullBook: LoreBook,
  assets?: { images?: Record<string, string>; audio?: Record<string, string> },
) {
  const supabase = requireSupabase();
  const leanBook = stripBookAssets(fullBook);
  const { premiumPages } = splitFreeAndPremiumPages(leanBook);
  const generatedAssets = buildAssetMaps(fullBook);
  const uploadedImages = await persistAssetMap(bookId, { ...generatedAssets.images, ...(assets?.images ?? {}) }, "image");
  const uploadedAudio = await persistAssetMap(bookId, { ...generatedAssets.audio, ...(assets?.audio ?? {}) }, "audio");
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      full_book: leanBook,
      premium_pages: premiumPages,
      images: { ...storedBook.images, ...uploadedImages },
      audio: { ...storedBook.audio, ...uploadedAudio },
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save the full book.");
  }

  return mapRow(data);
}

export async function savePdfUrl(bookId: string, pdfUrl: string | null) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ pdf_url: pdfUrl })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save PDF URL.");
  }

  return mapRow(data);
}

export async function savePdfPath(bookId: string, pdfStoragePath: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      pdf_storage_path: pdfStoragePath,
      pdf_status: "ready",
      pdf_generated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save PDF path.");
  }

  return mapRow(data);
}

export async function saveEmail(bookId: string, email: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ email })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save email.");
  }

  return mapRow(data);
}

export async function saveStripePayment(
  bookId: string,
  stripePaymentIntentId: string | null,
  email: string | null,
) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      stripe_payment_intent_id: stripePaymentIntentId,
      ...(email ? { email } : {}),
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save Stripe payment.");
  }

  return mapRow(data);
}

export async function markBookReady(bookId: string) {
  return updateBookStatus(bookId, "ready");
}

export async function claimPageImageGeneration(bookId: string, pageNumber: number) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    return null;
  }

  const key = String(pageNumber);
  const currentStatus = storedBook.image_status[key] || (storedBook.images[key] ? "ready" : "not_started");
  if (currentStatus === "ready" || currentStatus === "generating") {
    return null;
  }

  const nextImageStatus = {
    ...storedBook.image_status,
    [key]: "generating" as ImagePageStatus,
  };

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ image_status: nextImageStatus })
    .eq("id", bookId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function markPageImageFailed(bookId: string, pageNumber: number) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const key = String(pageNumber);
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      image_status: {
        ...storedBook.image_status,
        [key]: "failed",
      },
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark image as failed.");
  }

  return mapRow(data);
}

export async function markBookFailed(bookId: string) {
  return updateBookStatus(bookId, "failed");
}

export async function claimConfirmationEmailSend(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ confirmation_email_status: "sending" })
    .eq("id", bookId)
    .is("confirmation_email_sent_at", null)
    .in("confirmation_email_status", ["not_started", "failed"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function markConfirmationEmailSent(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      confirmation_email_status: "sent",
      confirmation_email_sent_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark confirmation email as sent.");
  }

  return mapRow(data);
}

export async function markConfirmationEmailFailed(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ confirmation_email_status: "failed" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark confirmation email as failed.");
  }

  return mapRow(data);
}

export async function markConfirmationEmailSkipped(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ confirmation_email_status: "skipped" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark confirmation email as skipped.");
  }

  return mapRow(data);
}

export async function uploadBookPdf(bookId: string, pdfBuffer: Buffer) {
  const supabase = requireSupabase();
  const pdfStoragePath = `books/${bookId}/book.pdf`;

  const { error } = await supabase.storage.from(BOOK_PDF_BUCKET).upload(pdfStoragePath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  await savePdfPath(bookId, pdfStoragePath);
  return pdfStoragePath;
}

export async function createSignedPdfUrl(pdfStoragePath: string, expiresInSeconds = 3600) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from(BOOK_PDF_BUCKET)
    .createSignedUrl(pdfStoragePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create a signed PDF URL.");
  }

  return data.signedUrl;
}

export async function uploadBookMp3(bookId: string, mp3Buffer: Buffer) {
  const supabase = requireSupabase();
  const mp3StoragePath = `books/${bookId}/full-narration.mp3`;

  const { data: bucket } = await supabase.storage.getBucket(BOOK_AUDIO_BUCKET);
  if (!bucket) {
    const { error: createError } = await supabase.storage.createBucket(BOOK_AUDIO_BUCKET, {
      public: false,
      fileSizeLimit: 104857600,
      allowedMimeTypes: ["audio/mpeg", "audio/mp3"],
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(createError.message);
    }
  }

  const { error } = await supabase.storage.from(BOOK_AUDIO_BUCKET).upload(mp3StoragePath, mp3Buffer, {
    contentType: "audio/mpeg",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mp3StoragePath;
}

export async function createSignedMp3Url(mp3StoragePath: string, expiresInSeconds = 3600) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from(BOOK_AUDIO_BUCKET)
    .createSignedUrl(mp3StoragePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create a signed MP3 URL.");
  }

  return data.signedUrl;
}

export async function markMp3Generating(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ mp3_status: "generating" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update MP3 status.");
  }

  return mapRow(data);
}

export async function markMp3Ready(bookId: string, mp3StoragePath: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      mp3_status: "ready",
      mp3_storage_path: mp3StoragePath,
      mp3_generated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save MP3 path.");
  }

  return mapRow(data);
}

export async function markMp3Failed(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ mp3_status: "failed" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update MP3 status.");
  }

  return mapRow(data);
}

export async function markPdfWaitingForImages(bookId: string) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook || storedBook.pdf_storage_path) {
    return storedBook;
  }

  if (storedBook.pdf_status === "generating" || storedBook.pdf_status === "ready") {
    return storedBook;
  }

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ pdf_status: "waiting_for_images" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update PDF status.");
  }

  return mapRow(data);
}

export async function claimPdfGeneration(bookId: string) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook || storedBook.pdf_storage_path || storedBook.pdf_status === "generating") {
    return null;
  }

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ pdf_status: "generating" })
    .eq("id", bookId)
    .is("pdf_storage_path", null)
    .neq("pdf_status", "generating")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function markPdfFailed(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ pdf_status: "failed" })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update PDF status.");
  }

  return mapRow(data);
}

export async function ensureBookPdf(bookId: string, book: LoreBook) {
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (storedBook.pdf_storage_path) {
    return storedBook.pdf_storage_path;
  }

  const { generateBookPdf } = await import("@/lib/pdf");
  const pdfBuffer = await generateBookPdf(book);
  return uploadBookPdf(bookId, pdfBuffer);
}

export async function mergeBookAssets(
  book: LoreBook,
  images: Record<string, string>,
  audio: Record<string, string>,
): Promise<LoreBook> {
  const [resolvedImages, resolvedAudio] = await Promise.all([resolveAssetMap(images), resolveAssetMap(audio)]);

  return {
    ...book,
    pages: book.pages.map((page) => ({
      ...page,
      imageUrl: resolvedImages[String(page.pageNumber)] || page.imageUrl,
      audioUrl: resolvedAudio[String(page.pageNumber)] ?? page.audioUrl ?? null,
    })),
  };
}
