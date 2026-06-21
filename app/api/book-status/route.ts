import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck } from "@/lib/book-images";
import { hasPremiumAccess } from "@/lib/paymentVerification";

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
    const normalized = await getNormalizedImagesForStoredBook(storedBook);

    if (!normalized.allIllustrationsReady) {
      logPdfReadyCheck(normalized.input, "book-status");
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
      pdfStatus: storedBook.pdf_status,
      pdfStoragePath: storedBook.pdf_storage_path,
      characterName:
        storedBook.full_book?.characterBible.name || storedBook.free_book?.characterBible.name || null,
      title: storedBook.full_book?.title || storedBook.free_book?.title || null,
    });
  } catch (error) {
    console.error("Failed to load book status.", error);
    const message = error instanceof Error ? error.message : "Unable to load book status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
