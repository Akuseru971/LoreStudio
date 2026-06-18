import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { generateAccessToken } from "@/lib/accessToken";
import { BOOK_PDF_BUCKET, getSupabaseServerClient } from "@/lib/supabase/server";
import type { BookFormInput, BookPage, BookStatus, LoreBook, StoredBook } from "@/lib/types";

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
    audio: (row.audio as Record<string, string>) ?? {},
    pdf_url: row.pdf_url ? String(row.pdf_url) : null,
    pdf_storage_path: row.pdf_storage_path ? String(row.pdf_storage_path) : null,
    stripe_session_id: row.stripe_session_id ? String(row.stripe_session_id) : null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ? String(row.stripe_payment_intent_id) : null,
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
  const { freePages, premiumPages } = splitFreeAndPremiumPages(book);
  const { images, audio } = buildAssetMaps(book);

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .insert({
      access_token: accessToken,
      status: "free",
      form_input: formInput,
      free_book: book,
      free_pages: freePages,
      premium_pages: premiumPages,
      images,
      audio,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save the free book.");
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
  const { premiumPages } = splitFreeAndPremiumPages(fullBook);
  const { images, audio } = buildAssetMaps(fullBook);

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      full_book: fullBook,
      premium_pages: premiumPages,
      images: { ...images, ...(assets?.images ?? {}) },
      audio: { ...audio, ...(assets?.audio ?? {}) },
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
    .update({ pdf_storage_path: pdfStoragePath })
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

export async function markBookFailed(bookId: string) {
  return updateBookStatus(bookId, "failed");
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

export function mergeBookAssets(book: LoreBook, images: Record<string, string>, audio: Record<string, string>): LoreBook {
  return {
    ...book,
    pages: book.pages.map((page) => ({
      ...page,
      imageUrl: images[String(page.pageNumber)] || page.imageUrl,
      audioUrl: audio[String(page.pageNumber)] ?? page.audioUrl ?? null,
    })),
  };
}
