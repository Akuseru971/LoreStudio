import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck } from "@/lib/book-images";
import { finalizeBookIfReady } from "@/lib/bookCompletion";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";

export const runtime = "nodejs";

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

    if (!normalized.allIllustrationsReady) {
      logPdfReadyCheck(normalized.input, "book-status");
    }

    if (normalized.allIllustrationsReady && isPremium) {
      void finalizeBookIfReady(token).catch((error) => {
        console.error("Failed to finalize book from status poll.", error);
      });
    }

    return NextResponse.json({
      status: storedBook.status,
      accessToken: storedBook.access_token,
      isPremium,
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      images: normalized.images,
      imageStatus: normalized.images,
      illustrationsReadyCount: normalized.readyIllustrationCount,
      readyIllustrationCount: normalized.readyIllustrationCount,
      illustrationsTotal: FULL_BOOK_PAGE_COUNT,
      allIllustrationsReady: normalized.allIllustrationsReady,
      hasFailedIllustrations: normalized.hasFailedIllustrations,
      hasGeneratingIllustrations: normalized.hasGeneratingIllustrations,
      missingPages: normalized.missingPages,
      pdfStatus: storedBook.pdf_status || "not_started",
      pdfStoragePath: storedBook.pdf_storage_path,
      confirmationEmailStatus: storedBook.confirmation_email_status || "not_started",
      confirmationEmailSentAt: storedBook.confirmation_email_sent_at,
      confirmationEmailFailed: storedBook.confirmation_email_status === "failed",
      assetsReadyAt: storedBook.assets_ready_at,
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
