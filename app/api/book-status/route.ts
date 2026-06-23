import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { getBookReadinessSummary } from "@/lib/book-readiness";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const summary = getBookReadinessSummary(storedBook);
    const normalized = getNormalizedImagesForStoredBook(storedBook);

    return NextResponse.json({
      status: summary.status,
      accessToken: storedBook.access_token,
      isPremium,
      isPaid: summary.isPaid,
      canDownloadPdf: isPremium && summary.isReady,
      canDownloadMp3: isPremium,
      readyImagesCount: summary.readyImagesCount,
      totalImages: summary.totalImages,
      illustrationsReadyCount: summary.readyImagesCount,
      readyIllustrationCount: summary.readyImagesCount,
      illustrationsTotal: summary.totalImages,
      allIllustrationsReady: summary.isReady,
      isReady: summary.isReady,
      missingPremiumPages: summary.missingPremiumPages,
      failedPages: summary.failedPages,
      missingPages: normalized.missingPages,
      emailStatus: summary.emailStatus,
      images: normalized.images,
      imageStatus: normalized.images,
      hasFailedIllustrations: normalized.hasFailedIllustrations,
      hasGeneratingIllustrations: normalized.hasGeneratingIllustrations,
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
