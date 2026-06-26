import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { countReadyFreeImages, areFreeIllustrationsReady } from "@/lib/freeImages";
import { getClientProgressMessage, isGenerationPreparing } from "@/lib/generation-progress";
import { FREE_IMAGE_PAGE_COUNT, PREMIUM_IMAGE_PAGES } from "@/lib/image-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck } from "@/lib/book-images";
import { triggerFinalBookReadyEmailCheck } from "@/lib/finalBookReadyEmail";
import { arePremiumIllustrationsReady, getMissingPremiumImagePages } from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";
import { triggerPdfGenerationIfReady } from "@/lib/triggerPdfGeneration";
import type { GenerationProgressStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveGenerationStatus(storedBook: {
  generation_status: GenerationProgressStatus;
  free_book: unknown;
  status: string;
}): GenerationProgressStatus {
  if (storedBook.generation_status && storedBook.generation_status !== "not_started") {
    return storedBook.generation_status;
  }

  if (!storedBook.free_book) {
    return "generating_text";
  }

  if (areFreeIllustrationsReady(storedBook as Parameters<typeof areFreeIllustrationsReady>[0])) {
    return "ready_free";
  }

  return "generating_images";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const storedBook = await getBookByAccessToken(token);
    if (!storedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const isPremium = hasPremiumAccess(storedBook.status);
    const normalized = getNormalizedImagesForStoredBook(storedBook);
    const generationStatus = resolveGenerationStatus(storedBook);
    const readyFreeImageCount = countReadyFreeImages(storedBook);
    const freeIllustrationsReady = areFreeIllustrationsReady(storedBook);
    const hasText = Boolean(storedBook.free_book);
    const generationStartedAt = storedBook.generation_started_at || storedBook.created_at;
    const elapsedMs = generationStartedAt ? Date.now() - new Date(generationStartedAt).getTime() : 0;
    const isPreparing = isGenerationPreparing(generationStatus) && !freeIllustrationsReady;
    const progressMessage = getClientProgressMessage({
      elapsedMs: Math.max(0, elapsedMs),
      hasText,
      readyFreeImageCount,
    });

    const missingPremiumPages = isPremium ? getMissingPremiumImagePages(storedBook) : [];
    const premiumImagesReady = isPremium ? arePremiumIllustrationsReady(storedBook) : false;
    const pdfReady = storedBook.pdf_status === "ready" || Boolean(storedBook.pdf_storage_path);
    const pdfStatus = storedBook.pdf_status || "not_started";

    if (!normalized.allIllustrationsReady) {
      logPdfReadyCheck(normalized.input, "book-status");
    }

    if (
      isPremium &&
      normalized.allIllustrationsReady &&
      !pdfReady &&
      pdfStatus !== "generating"
    ) {
      void triggerPdfGenerationIfReady(storedBook.id, "book-status").catch((error) => {
        console.error("[PDF_AUTO_TRIGGER_ERROR]", { bookId: storedBook.id, error });
      });
    }

    if (
      isPremium &&
      normalized.allIllustrationsReady &&
      pdfReady &&
      storedBook.pdf_ready_email_status !== "sent" &&
      !storedBook.pdf_ready_email_sent_at
    ) {
      void triggerFinalBookReadyEmailCheck(storedBook.id).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId: storedBook.id, error });
      });
    }

    console.log("[BOOK_STATUS]", {
      bookId: storedBook.id,
      status: storedBook.status,
      generationStatus,
      readyImagesCount: normalized.readyIllustrationCount,
      missingPremiumPages,
    });

    return NextResponse.json({
      success: true,
      status: storedBook.status,
      generationStatus,
      generationError: storedBook.generation_error,
      generationStartedAt: storedBook.generation_started_at,
      generationUpdatedAt: storedBook.generation_updated_at || storedBook.updated_at,
      isPreparing,
      progressMessage,
      message: isPreparing ? "Generation still in progress" : "Book status loaded",
      accessToken: storedBook.access_token,
      isPremium,
      isPaid: isPremium,
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      images: normalized.images,
      imageStatus: normalized.images,
      illustrationsReadyCount: normalized.readyIllustrationCount,
      readyIllustrationCount: normalized.readyIllustrationCount,
      readyImagesCount: normalized.readyIllustrationCount,
      totalImages: FULL_BOOK_PAGE_COUNT,
      readyFreeImageCount,
      freeImagesTotal: FREE_IMAGE_PAGE_COUNT,
      illustrationsTotal: FULL_BOOK_PAGE_COUNT,
      allIllustrationsReady: normalized.allIllustrationsReady,
      freeIllustrationsReady,
      premiumImagesReady,
      missingPremiumPages,
      premiumImagesTotal: PREMIUM_IMAGE_PAGES.length,
      hasFailedIllustrations: normalized.hasFailedIllustrations,
      hasGeneratingIllustrations: normalized.hasGeneratingIllustrations,
      missingPages: normalized.missingPages,
      pdfStatus,
      pdfStoragePath: storedBook.pdf_storage_path,
      pdfReady,
      audioStatus: storedBook.mp3_status || "not_started",
      characterName:
        storedBook.full_book?.characterBible.name || storedBook.free_book?.characterBible.name || null,
      title: storedBook.full_book?.title || storedBook.free_book?.title || null,
    });
  } catch (error) {
    console.error("Failed to load book status.", error);
    const message = getSafeApiErrorMessage(error, "Unable to load book status.");
    return NextResponse.json(
      {
        error: message,
        reason: isSupabaseSchemaError(error) ? "schema_out_of_date" : undefined,
      },
      { status: isSupabaseSchemaError(error) ? 503 : 500 },
    );
  }
}
