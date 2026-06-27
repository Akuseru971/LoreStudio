import "server-only";

import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { generateAccessToken } from "@/lib/accessToken";
import { createSignedAssetUrl, persistAssetMap, resolveAssetMap } from "@/lib/bookAssets";
import {
  getImageForPage,
  getReadyIllustrationCount,
  isIllustrationReady,
  mergeUpdatedImage,
  normalizeStoredBookImages,
  resolveImageDisplayUrl,
} from "@/lib/book-images";
import { BOOK_AUDIO_BUCKET, BOOK_PDF_BUCKET, getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ApprovedSynopsis,
  BookFormInput,
  BookPage,
  BookPageImage,
  BookStatus,
  ConfirmationEmailStatus,
  GenerationProgressStatus,
  ImagePageStatus,
  LoreBook,
  Mp3Status,
  PaymentEmailStatus,
  PdfReadyEmailStatus,
  PdfStatus,
  StoredBook,
} from "@/lib/types";
import {
  getImageGenerationTimestamp,
  getPageGenerationStatus,
  isImageFreshlyGenerating,
} from "@/lib/imageGenerationTimestamps";
import { createDefaultImageStatusMap } from "@/lib/imageStatus";
import { resolveApprovedSynopsis } from "@/lib/synopsisValidation";
import { isSupabaseSchemaError } from "@/lib/supabaseErrors";
import { stripBookAssets } from "@/lib/utils";

const BOOKS_TABLE = "books";

function normalizePdfStatus(value: unknown, pdfStoragePath: unknown): PdfStatus {
  if (pdfStoragePath) {
    return "ready";
  }

  if (typeof value === "string" && value.trim()) {
    return value as PdfStatus;
  }

  return "not_started";
}

function normalizeMp3Status(value: unknown, mp3StoragePath: unknown): Mp3Status {
  if (mp3StoragePath) {
    return "ready";
  }

  if (typeof value === "string" && value.trim()) {
    return value as Mp3Status;
  }

  return "not_started";
}

function requireSupabase() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

function mapRow(row: Record<string, unknown>): StoredBook {
  const formInput = (row.form_input as BookFormInput | null) ?? {
    name: "Traveler",
    gender: "unknown",
    characterType: "Wanderer",
    runeterraRegion: "Auto",
  };

  return {
    id: String(row.id),
    access_token: String(row.access_token),
    email: row.email ? String(row.email) : null,
    status: (row.status as BookStatus) || "free",
    form_input: formInput,
    approved_synopsis: resolveApprovedSynopsis({
      approved_synopsis: row.approved_synopsis as ApprovedSynopsis | null,
      form_input: formInput,
    }),
    free_book: (row.free_book as LoreBook | null) ?? null,
    full_book: (row.full_book as LoreBook | null) ?? null,
    free_pages: (row.free_pages as BookPage[] | null) ?? null,
    premium_pages: (row.premium_pages as BookPage[] | null) ?? null,
    images: (row.images as Record<string, BookPageImage | string>) ?? {},
    image_status: (row.image_status as Record<string, ImagePageStatus>) ?? {},
    audio: (row.audio as Record<string, string>) ?? {},
    pdf_url: row.pdf_url ? String(row.pdf_url) : null,
    pdf_storage_path: row.pdf_storage_path ? String(row.pdf_storage_path) : null,
    pdf_status: normalizePdfStatus(row.pdf_status, row.pdf_storage_path),
    pdf_generated_at: row.pdf_generated_at ? String(row.pdf_generated_at) : null,
    pdf_error: row.pdf_error ? String(row.pdf_error) : null,
    mp3_storage_path: row.mp3_storage_path ? String(row.mp3_storage_path) : null,
    mp3_generated_at: row.mp3_generated_at ? String(row.mp3_generated_at) : null,
    mp3_status: normalizeMp3Status(row.mp3_status, row.mp3_storage_path),
    mp3_error: row.mp3_error ? String(row.mp3_error) : null,
    stripe_session_id: row.stripe_session_id ? String(row.stripe_session_id) : null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ? String(row.stripe_payment_intent_id) : null,
    confirmation_email_sent_at: row.confirmation_email_sent_at ? String(row.confirmation_email_sent_at) : null,
    confirmation_email_status: (row.confirmation_email_status as ConfirmationEmailStatus | null) ?? "not_started",
    confirmation_email_error: row.confirmation_email_error ? String(row.confirmation_email_error) : null,
    payment_email_sent_at: row.payment_email_sent_at ? String(row.payment_email_sent_at) : null,
    payment_email_status: (row.payment_email_status as PaymentEmailStatus | null) ?? "not_started",
    payment_email_error: row.payment_email_error ? String(row.payment_email_error) : null,
    pdf_ready_email_sent_at: row.pdf_ready_email_sent_at ? String(row.pdf_ready_email_sent_at) : null,
    pdf_ready_email_status: (row.pdf_ready_email_status as PdfReadyEmailStatus | null) ?? "not_started",
    pdf_ready_email_error: row.pdf_ready_email_error ? String(row.pdf_ready_email_error) : null,
    generation_status: (row.generation_status as GenerationProgressStatus | null) ?? "not_started",
    generation_started_at: row.generation_started_at ? String(row.generation_started_at) : null,
    generation_updated_at: row.generation_updated_at ? String(row.generation_updated_at) : null,
    generation_error: row.generation_error ? String(row.generation_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function splitFreeAndPremiumPages(book: LoreBook) {
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const freePages = pages.slice(0, ILLUSTRATED_PAGE_COUNT);
  const premiumPages = pages.slice(ILLUSTRATED_PAGE_COUNT);
  return { freePages, premiumPages };
}

function buildAssetMaps(book: LoreBook) {
  const images: Record<string, string> = {};
  const audio: Record<string, string> = {};
  const pages = Array.isArray(book.pages) ? book.pages : [];

  for (const page of pages) {
    if (page.imageUrl) {
      images[String(page.pageNumber)] = page.imageUrl;
    }
    if (page.audioUrl) {
      audio[String(page.pageNumber)] = page.audioUrl;
    }
  }

  return { images, audio };
}

export async function createFreeBook(
  formInput: BookFormInput,
  book: LoreBook,
  approvedSynopsis: ApprovedSynopsis | null = null,
) {
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
      approved_synopsis: approvedSynopsis,
      free_book: leanBook,
      free_pages: freePages,
      premium_pages: premiumPages,
      images: {},
      image_status: createDefaultImageStatusMap(),
      audio: {},
      generation_status: "generating_images",
      generation_started_at: new Date().toISOString(),
      generation_updated_at: new Date().toISOString(),
      generation_error: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save the free book.");
  }

  return mapRow(data);
}

export async function saveNormalizedBookImages(
  bookId: string,
  images: Record<string, BookPageImage>,
  imageStatus: Record<string, ImagePageStatus>,
) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      images,
      image_status: imageStatus,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save normalized book images.");
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const storedBook = await getBookByAccessToken(accessToken);
    if (!storedBook) {
      throw new Error("Book not found.");
    }

    console.log("[IMAGE_SAVE_START]", { bookId: storedBook.id, pageNumber, assetType, attempt });

    const storagePath = await persistAssetMap(
      storedBook.id,
      { [String(pageNumber)]: assetRef },
      assetType,
    );
    const persistedRef = storagePath[String(pageNumber)];
    if (!persistedRef) {
      throw new Error("Unable to persist book asset.");
    }

    console.log("[IMAGE_UPLOAD_DONE]", { bookId: storedBook.id, pageNumber, storagePath: persistedRef });

    if (assetType === "audio") {
      const nextAudio = {
        ...storedBook.audio,
        [String(pageNumber)]: persistedRef,
      };

      const { data, error } = await supabase
        .from(BOOKS_TABLE)
        .update({ audio: nextAudio })
        .eq("id", storedBook.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Unable to save book asset.");
      }

      return mapRow(data);
    }

    const signedUrl = await createSignedAssetUrl(persistedRef, 3600);
    const normalized = normalizeStoredBookImages(storedBook);
    const updatedImages = mergeUpdatedImage(normalized.images, pageNumber, {
      pageNumber,
      status: "ready",
      url: signedUrl,
      storagePath: persistedRef,
      generatedAt: new Date().toISOString(),
    });
    const nextImageStatus = {
      ...normalized.imageStatus,
      [String(pageNumber)]: "ready" as ImagePageStatus,
    };

    const { data, error } = await supabase
      .from(BOOKS_TABLE)
      .update({
        images: updatedImages,
        image_status: nextImageStatus,
      })
      .eq("id", storedBook.id)
      .select("*")
      .single();

    if (!error && data) {
      console.log("[IMAGE_BOOK_UPDATE_DONE]", {
        bookId: storedBook.id,
        pageNumber,
        url: signedUrl,
        storagePath: persistedRef,
      });
      console.log("[IMAGE_READY_COUNT]", getReadyIllustrationCount({
        images: updatedImages,
        imageStatus: nextImageStatus,
      }));
      return mapRow(data);
    }

    if (attempt === 3) {
      throw new Error(error?.message || "Unable to save book asset.");
    }
  }

  throw new Error("Unable to save book asset.");
}

export async function getBookById(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from(BOOKS_TABLE).select("*").eq("id", bookId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapRow(data) : null;
}

export async function findPaidBooksWithIncompletePremiumGeneration(limit = 3) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .select("*")
    .in("status", ["paid", "generating"])
    .in("generation_status", ["preparing", "generating_images"])
    .order("generation_updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapRow);
}

function synopsisMatches(
  storedSynopsis: ApprovedSynopsis | null | undefined,
  requestedSynopsis: ApprovedSynopsis | null | undefined,
) {
  if (!storedSynopsis || !requestedSynopsis) {
    return false;
  }

  return storedSynopsis.synopsis?.trim() === requestedSynopsis.synopsis?.trim();
}

export async function findExistingGenerationBook(
  formInput: BookFormInput,
  approvedSynopsis: ApprovedSynopsis | null,
) {
  const supabase = requireSupabase();
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .select("*")
    .eq("form_input->>name", formInput.name)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("[FIND_EXISTING_GENERATION_BOOK_ERROR]", error.message);
    return null;
  }

  for (const row of data || []) {
    const storedBook = mapRow(row);
    if (!storedBook.free_book) {
      continue;
    }

    if (!synopsisMatches(storedBook.approved_synopsis, approvedSynopsis)) {
      continue;
    }

    if (storedBook.generation_status === "failed" || storedBook.status === "failed") {
      continue;
    }

    return storedBook;
  }

  return null;
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

  if (!data) {
    return null;
  }

  const storedBook = mapRow(data);
  const normalized = normalizeStoredBookImages(storedBook);

  if (!normalized.changed) {
    return storedBook;
  }

  try {
    return await saveNormalizedBookImages(storedBook.id, normalized.images, normalized.imageStatus);
  } catch (repairError) {
    console.warn("[IMAGE_NORMALIZE_PERSIST_FAILED]", repairError);
    return {
      ...storedBook,
      images: normalized.images,
      image_status: normalized.imageStatus,
    };
  }
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

  const normalized = normalizeStoredBookImages(storedBook);
  const mergedImages = { ...normalized.images };

  for (const [pageKey, storagePath] of Object.entries(uploadedImages)) {
    const pageNumber = Number(pageKey);
    if (!Number.isInteger(pageNumber)) {
      continue;
    }

    const signedUrl = await createSignedAssetUrl(storagePath, 3600);
    mergedImages[pageKey] = {
      pageNumber,
      status: "ready",
      url: signedUrl,
      storagePath,
      generatedAt: new Date().toISOString(),
    };
  }

  const nextImageStatus = { ...normalized.imageStatus };
  for (const pageKey of Object.keys(mergedImages)) {
    if (isIllustrationReady(mergedImages[pageKey])) {
      nextImageStatus[pageKey] = "ready";
    }
  }

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      full_book: leanBook,
      premium_pages: premiumPages,
      images: mergedImages,
      image_status: nextImageStatus,
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
      pdf_error: null,
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

export async function updateGenerationProgress(
  bookId: string,
  generationStatus: GenerationProgressStatus,
  options: { generationError?: string | null; touchStartedAt?: boolean } = {},
) {
  const supabase = requireSupabase();
  const patch: Record<string, unknown> = {
    generation_status: generationStatus,
    generation_updated_at: new Date().toISOString(),
  };

  if (options.generationError !== undefined) {
    patch.generation_error = options.generationError;
  }

  if (options.touchStartedAt) {
    patch.generation_started_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from(BOOKS_TABLE).update(patch).eq("id", bookId).select("*").maybeSingle();

  if (error) {
    console.warn("[UPDATE_GENERATION_PROGRESS_FAILED]", error.message);
    return null;
  }

  return data ? mapRow(data) : null;
}

export async function markGenerationFailed(bookId: string, message: string) {
  await updateGenerationProgress(bookId, "failed", { generationError: message });
  return updateBookStatus(bookId, "failed");
}

export async function markBookReady(bookId: string) {
  return updateBookStatus(bookId, "ready");
}

export async function stampMissingGeneratingTimestamp(bookId: string, pageNumber: number) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    return null;
  }

  const key = String(pageNumber);
  const status = storedBook.image_status[key];
  if (status !== "generating") {
    return storedBook;
  }

  if (getImageGenerationTimestamp(storedBook, pageNumber)) {
    return storedBook;
  }

  const now = new Date().toISOString();
  const normalized = normalizeStoredBookImages(storedBook);
  const updatedImages = mergeUpdatedImage(normalized.images, pageNumber, {
    pageNumber,
    status: "generating",
    url: null,
    storagePath: null,
    generatedAt: null,
    startedAt: now,
    updatedAt: now,
    generationStartedAt: now,
  });
  const nextImageStatus = {
    ...normalized.imageStatus,
    [key]: "generating" as ImagePageStatus,
  };

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      images: updatedImages,
      image_status: nextImageStatus,
    })
    .eq("id", bookId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function resetStalePageImageGeneration(bookId: string, pageNumber: number) {
  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    return null;
  }

  const key = String(pageNumber);
  const normalized = normalizeStoredBookImages(storedBook);
  const updatedImages = mergeUpdatedImage(normalized.images, pageNumber, {
    pageNumber,
    status: "not_started",
    url: null,
    storagePath: null,
    generatedAt: null,
    startedAt: null,
    updatedAt: new Date().toISOString(),
  });
  const nextImageStatus = {
    ...normalized.imageStatus,
    [key]: "not_started" as ImagePageStatus,
  };

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      images: updatedImages,
      image_status: nextImageStatus,
    })
    .eq("id", bookId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function claimPageImageGeneration(bookId: string, pageNumber: number) {
  console.log("[IMAGE_GENERATION_CLAIM_START]", {
    bookId,
    pageNumber,
  });

  const supabase = requireSupabase();
  const storedBook = await getBookById(bookId);
  if (!storedBook) {
    return null;
  }

  const key = String(pageNumber);
  const pageState = getPageGenerationStatus(storedBook, pageNumber);

  if (pageState.isReady) {
    return null;
  }

  if (pageState.status === "generating" && isImageFreshlyGenerating(storedBook, pageNumber)) {
    return null;
  }

  const now = new Date().toISOString();
  const normalized = normalizeStoredBookImages(storedBook);
  const updatedImages = mergeUpdatedImage(normalized.images, pageNumber, {
    pageNumber,
    status: "generating",
    url: null,
    storagePath: null,
    generatedAt: null,
    startedAt: now,
    updatedAt: now,
    generationStartedAt: now,
  });
  const nextImageStatus = {
    ...normalized.imageStatus,
    [key]: "generating" as ImagePageStatus,
  };

  console.log("[IMAGE_GENERATION_CLAIM_WRITTEN]", {
    bookId,
    pageNumber,
    startedAt: now,
    updatedAt: now,
  });

  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      images: updatedImages,
      image_status: nextImageStatus,
    })
    .eq("id", bookId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const claimedBook = data ? mapRow(data) : null;
  if (claimedBook) {
    const claimedState = getPageGenerationStatus(claimedBook, pageNumber);
    console.log("[IMAGE_GENERATION_CLAIM_VERIFY]", {
      bookId,
      pageNumber,
      status: claimedState.status,
      startedAt: claimedState.startedAt,
      updatedAt: claimedState.updatedAt,
    });
  }

  return claimedBook;
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
    .in("confirmation_email_status", ["not_started", "failed", "skipped"])
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
      confirmation_email_error: null,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark confirmation email as sent.");
  }

  return mapRow(data);
}

export async function markConfirmationEmailFailed(bookId: string, errorMessage?: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      confirmation_email_status: "failed",
      confirmation_email_error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
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

export async function claimPaymentEmailSend(bookId: string) {
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase
      .from(BOOKS_TABLE)
      .update({ payment_email_status: "sending" })
      .eq("id", bookId)
      .is("payment_email_sent_at", null)
      .in("payment_email_status", ["not_started", "failed", "skipped"])
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapRow(data) : null;
  } catch (error) {
    if (isSupabaseSchemaError(error)) {
      console.warn("[PAYMENT_EMAIL_SCHEMA_FALLBACK]", {
        bookId,
        field: "payment_email_status",
        fallback: "confirmation_email_status",
      });
      return claimConfirmationEmailSend(bookId);
    }

    throw error;
  }
}

export async function markPaymentEmailSent(bookId: string) {
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase
      .from(BOOKS_TABLE)
      .update({
        payment_email_status: "sent",
        payment_email_sent_at: new Date().toISOString(),
        payment_email_error: null,
      })
      .eq("id", bookId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to mark payment email as sent.");
    }

    return mapRow(data);
  } catch (error) {
    if (isSupabaseSchemaError(error)) {
      console.warn("[PAYMENT_EMAIL_SCHEMA_FALLBACK]", {
        bookId,
        field: "payment_email_status",
        fallback: "confirmation_email_status",
      });
      return markConfirmationEmailSent(bookId);
    }

    throw error;
  }
}

export async function markPaymentEmailFailed(bookId: string, errorMessage?: string) {
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase
      .from(BOOKS_TABLE)
      .update({
        payment_email_status: "failed",
        payment_email_error: errorMessage ? errorMessage.slice(0, 500) : null,
      })
      .eq("id", bookId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to mark payment email as failed.");
    }

    return mapRow(data);
  } catch (error) {
    if (isSupabaseSchemaError(error)) {
      console.warn("[PAYMENT_EMAIL_SCHEMA_FALLBACK]", {
        bookId,
        field: "payment_email_status",
        fallback: "confirmation_email_status",
      });
      return markConfirmationEmailFailed(bookId, errorMessage);
    }

    throw error;
  }
}

export async function markPaymentEmailSkipped(bookId: string) {
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase
      .from(BOOKS_TABLE)
      .update({ payment_email_status: "skipped" })
      .eq("id", bookId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to mark payment email as skipped.");
    }

    return mapRow(data);
  } catch (error) {
    if (isSupabaseSchemaError(error)) {
      console.warn("[PAYMENT_EMAIL_SCHEMA_FALLBACK]", {
        bookId,
        field: "payment_email_status",
        fallback: "confirmation_email_status",
      });
      return markConfirmationEmailSkipped(bookId);
    }

    throw error;
  }
}

export async function claimPdfReadyEmailSend(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({ pdf_ready_email_status: "sending" })
    .eq("id", bookId)
    .is("pdf_ready_email_sent_at", null)
    .in("pdf_ready_email_status", ["not_started", "failed"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function markPdfReadyEmailSent(bookId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      pdf_ready_email_status: "sent",
      pdf_ready_email_sent_at: new Date().toISOString(),
      pdf_ready_email_error: null,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark PDF ready email as sent.");
  }

  return mapRow(data);
}

export async function markPdfReadyEmailFailed(bookId: string, errorMessage?: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      pdf_ready_email_status: "failed",
      pdf_ready_email_error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to mark PDF ready email as failed.");
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

export async function downloadBookPdf(pdfStoragePath: string): Promise<Buffer> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(BOOK_PDF_BUCKET).download(pdfStoragePath);

  if (error || !data) {
    throw new Error(error?.message || "Unable to download PDF from storage.");
  }

  return Buffer.from(await data.arrayBuffer());
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
      mp3_error: null,
    })
    .eq("id", bookId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save MP3 path.");
  }

  return mapRow(data);
}

export async function markMp3Failed(bookId: string, errorMessage?: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      mp3_status: "failed",
      mp3_error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
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

export async function markPdfFailed(bookId: string, errorMessage?: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(BOOKS_TABLE)
    .update({
      pdf_status: "failed",
      pdf_error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
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
  const normalized = normalizeStoredBookImages(storedBook);
  const pdfBuffer = await generateBookPdf(book, {
    images: normalized.images,
    imageStatus: normalized.imageStatus,
  });
  return uploadBookPdf(bookId, pdfBuffer);
}

export async function mergeBookAssets(
  book: LoreBook,
  images: Record<string, BookPageImage | string>,
  audio: Record<string, string>,
): Promise<LoreBook> {
  const resolvedAudio = await resolveAssetMap(audio);
  const sourcePages = Array.isArray(book.pages) ? book.pages : [];
  const imagesInput = { images, pages: sourcePages };

  const pages = await Promise.all(
    sourcePages.map(async (page) => {
      const image = getImageForPage(imagesInput, page.pageNumber);
      const imageUrl = (await resolveImageDisplayUrl(image)) || page.imageUrl || undefined;

      return {
        ...page,
        imageUrl,
        audioUrl: resolvedAudio[String(page.pageNumber)] ?? page.audioUrl ?? null,
      };
    }),
  );

  return {
    ...book,
    pages,
  };
}
