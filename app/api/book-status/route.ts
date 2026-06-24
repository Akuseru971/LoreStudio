import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { countReadyFreeImages, areFreeIllustrationsReady } from "@/lib/freeImages";
import { getClientProgressMessage, isGenerationPreparing } from "@/lib/generation-progress";
import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck } from "@/lib/book-images";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";
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

    if (!normalized.allIllustrationsReady) {
      logPdfReadyCheck(normalized.input, "book-status");
    }

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
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      images: normalized.images,
      imageStatus: normalized.images,
      illustrationsReadyCount: normalized.readyIllustrationCount,
      readyIllustrationCount: normalized.readyIllustrationCount,
      readyFreeImageCount,
      freeImagesTotal: FREE_IMAGE_PAGE_COUNT,
      illustrationsTotal: FULL_BOOK_PAGE_COUNT,
      allIllustrationsReady: normalized.allIllustrationsReady,
      freeIllustrationsReady,
      hasFailedIllustrations: normalized.hasFailedIllustrations,
      hasGeneratingIllustrations: normalized.hasGeneratingIllustrations,
      missingPages: normalized.missingPages,
      pdfStatus: storedBook.pdf_status || "not_started",
      pdfStoragePath: storedBook.pdf_storage_path,
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
