import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { countReadyFreeImages, getFreePreviewReadiness } from "@/lib/freeImages";
import { getClientProgressMessage, isGenerationPreparing } from "@/lib/generation-progress";
import { FREE_IMAGE_PAGE_COUNT, FREE_PREVIEW_POSTER_IMAGE_KEY, PREMIUM_IMAGE_PAGES } from "@/lib/image-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck, resolvePreviewCoverImageForClient } from "@/lib/book-images";
import { triggerFinalBookReadyEmailCheck } from "@/lib/finalBookReadyEmail";
import { arePremiumIllustrationsReady, getMissingPremiumImagePages, getPremiumGenerationStatus, recoverStalePremiumImages } from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";
import { triggerPdfGenerationIfReady } from "@/lib/triggerPdfGeneration";
import type { GenerationProgressStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveGenerationStatus(
  storedBook: {
    generation_status: GenerationProgressStatus;
    free_book: unknown;
    status: string;
  },
  isPremium: boolean,
): GenerationProgressStatus {
  if (isPremium) {
    if (storedBook.generation_status && storedBook.generation_status !== "not_started") {
      return storedBook.generation_status;
    }

    return storedBook.free_book ? "generating_images" : "generating_text";
  }

  const freePreview = getFreePreviewReadiness(storedBook as Parameters<typeof getFreePreviewReadiness>[0]);
  if (freePreview.freePreviewReady) {
    return "ready_free";
  }

  if (storedBook.generation_status && storedBook.generation_status !== "not_started") {
    return storedBook.generation_status;
  }

  if (!storedBook.free_book) {
    return "generating_text";
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
    let activeBook = storedBook;
    if (isPremium) {
      activeBook = (await recoverStalePremiumImages(storedBook)) || storedBook;
    }

    const normalized = getNormalizedImagesForStoredBook(activeBook);
    const freePreviewReadiness = getFreePreviewReadiness(activeBook);
    const generationStatus = resolveGenerationStatus(activeBook, isPremium);
    const readyFreeImageCount = countReadyFreeImages(activeBook);
    const freeIllustrationsReady = freePreviewReadiness.freePreviewReady;
    const hasText = Boolean(activeBook.free_book);
    const generationStartedAt = activeBook.generation_started_at || activeBook.created_at;
    const elapsedMs = generationStartedAt ? Date.now() - new Date(generationStartedAt).getTime() : 0;
    const isPreparing = isGenerationPreparing(generationStatus) && !freeIllustrationsReady;
    const progressMessage = getClientProgressMessage({
      elapsedMs: Math.max(0, elapsedMs),
      hasText,
      readyFreeImageCount: freePreviewReadiness.readyPreviewAssetsCount,
    });
    const previewCover = (await resolvePreviewCoverImageForClient(normalized.images))[FREE_PREVIEW_POSTER_IMAGE_KEY] ?? null;
    const responseImages = await resolvePreviewCoverImageForClient(normalized.images);

    const missingPremiumPages = isPremium ? getMissingPremiumImagePages(activeBook) : [];
    const premiumImagesReady = isPremium ? arePremiumIllustrationsReady(activeBook) : false;
    const premiumGeneration = isPremium ? getPremiumGenerationStatus(activeBook) : null;
    const pdfReady = activeBook.pdf_status === "ready" || Boolean(activeBook.pdf_storage_path);
    const pdfStatus = activeBook.pdf_status || "not_started";

    if (!normalized.allIllustrationsReady) {
      logPdfReadyCheck(normalized.input, "book-status");
    }

    if (
      isPremium &&
      normalized.allIllustrationsReady &&
      !pdfReady &&
      pdfStatus !== "generating"
    ) {
      void triggerPdfGenerationIfReady(activeBook.id, "book-status").catch((error) => {
        console.error("[PDF_AUTO_TRIGGER_ERROR]", { bookId: activeBook.id, error });
      });
    }

    if (
      isPremium &&
      normalized.allIllustrationsReady &&
      pdfReady &&
      activeBook.pdf_ready_email_status !== "sent" &&
      !activeBook.pdf_ready_email_sent_at
    ) {
      void triggerFinalBookReadyEmailCheck(activeBook.id).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId: activeBook.id, error });
      });
    }

    console.log("[PREMIUM_GENERATION_STATUS]", {
      bookId: activeBook.id,
      readyImagesCount: normalized.readyIllustrationCount,
      missingPremiumPages,
      stalePremiumPages: premiumGeneration?.stalePremiumPages || [],
    });

    console.log("[BOOK_STATUS]", {
      bookId: activeBook.id,
      status: activeBook.status,
      generationStatus,
      readyImagesCount: normalized.readyIllustrationCount,
      previewCoverReady: freePreviewReadiness.previewCoverReady,
      readyPreviewAssetsCount: freePreviewReadiness.readyPreviewAssetsCount,
      freePreviewReady: freePreviewReadiness.freePreviewReady,
      missingPremiumPages,
    });

    return NextResponse.json({
      success: true,
      status: activeBook.status,
      generationStatus,
      generationError: activeBook.generation_error,
      generationStartedAt: activeBook.generation_started_at,
      generationUpdatedAt: activeBook.generation_updated_at || activeBook.updated_at,
      isPreparing,
      progressMessage,
      message: isPreparing ? "Generation still in progress" : "Book status loaded",
      accessToken: activeBook.access_token,
      isPremium,
      isPaid: isPremium,
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      images: responseImages,
      imageStatus: responseImages,
      illustrationsReadyCount: normalized.readyIllustrationCount,
      readyIllustrationCount: normalized.readyIllustrationCount,
      readyImagesCount: normalized.readyIllustrationCount,
      totalImages: FULL_BOOK_PAGE_COUNT,
      readyFreeImageCount,
      freeImagesTotal: FREE_IMAGE_PAGE_COUNT,
      readyPreviewAssetsCount: freePreviewReadiness.readyPreviewAssetsCount,
      previewCoverReady: freePreviewReadiness.previewCoverReady,
      previewReady: freePreviewReadiness.freePreviewReady,
      freePreviewReady: freePreviewReadiness.freePreviewReady,
      page1Ready: freePreviewReadiness.page1Ready,
      page2Ready: freePreviewReadiness.page2Ready,
      previewCover,
      illustrationsTotal: FULL_BOOK_PAGE_COUNT,
      allIllustrationsReady: normalized.allIllustrationsReady,
      freeIllustrationsReady,
      premiumImagesReady,
      missingPremiumPages,
      stalePremiumPages: premiumGeneration?.stalePremiumPages || [],
      shouldContinuePremiumGeneration: premiumGeneration?.shouldContinuePremiumGeneration || false,
      premiumImagesTotal: PREMIUM_IMAGE_PAGES.length,
      hasFailedIllustrations: normalized.hasFailedIllustrations,
      hasGeneratingIllustrations: normalized.hasGeneratingIllustrations,
      missingPages: normalized.missingPages,
      pdfStatus,
      pdfStoragePath: activeBook.pdf_storage_path,
      pdfReady,
      audioStatus: activeBook.mp3_status || "not_started",
      characterName:
        activeBook.full_book?.characterBible.name || activeBook.free_book?.characterBible.name || null,
      title: activeBook.full_book?.title || activeBook.free_book?.title || null,
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
