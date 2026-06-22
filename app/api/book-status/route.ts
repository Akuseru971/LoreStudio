import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { getNormalizedImagesForStoredBook, logPdfReadyCheck } from "@/lib/book-images";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "/api/book-status";

export async function GET(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

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

    logRouteSuccess(ROUTE_NAME);

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
      characterName:
        storedBook.full_book?.characterBible.name || storedBook.free_book?.characterBible.name || null,
      title: storedBook.full_book?.title || storedBook.free_book?.title || null,
    });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "Unable to load book status.");
    if (response) {
      return response;
    }

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
