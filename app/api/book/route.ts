import { NextResponse } from "next/server";
import { getBookByAccessToken, mergeBookAssets } from "@/lib/bookStore";
import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { normalizeBook } from "@/lib/normalizeBook";
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
    const sourceBook = isPremium ? storedBook.full_book || storedBook.free_book : storedBook.free_book;
    const normalized = getNormalizedImagesForStoredBook(storedBook);
    const mergedBook = sourceBook
      ? await mergeBookAssets(sourceBook, normalized.normalizedImages, storedBook.audio)
      : null;
    const book = mergedBook ? normalizeBook(mergedBook) : null;

    return NextResponse.json({
      status: storedBook.status,
      accessToken: storedBook.access_token,
      email: storedBook.email,
      book,
      imageStatus: normalized.images,
      images: normalized.images,
      isPremium,
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      readyIllustrationCount: normalized.readyIllustrationCount,
      allIllustrationsReady: normalized.allIllustrationsReady,
      missingPages: normalized.missingPages,
      pageCount: isPremium ? FULL_BOOK_PAGE_COUNT : ILLUSTRATED_PAGE_COUNT,
    });
  } catch (error) {
    console.error("[API_BOOK_ERROR]", error);
    const message = getSafeApiErrorMessage(error, "Unable to load book.");
    return NextResponse.json(
      {
        error: message,
        reason: isSupabaseSchemaError(error) ? "schema_out_of_date" : undefined,
      },
      { status: isSupabaseSchemaError(error) ? 503 : 500 },
    );
  }
}
