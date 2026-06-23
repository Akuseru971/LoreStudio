import { NextResponse } from "next/server";
import { getReadyIllustrationCount } from "@/lib/book-images";
import { createFreeBook, mergeBookAssets } from "@/lib/bookStore";
import { generateFreeBookImages } from "@/lib/freeImages";
import { generateLoreBook, isDevOrPreview } from "@/lib/loreGeneration";
import { normalizeBook } from "@/lib/normalizeBook";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";
import { validateGenerateBookRequest } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_NAME = "/api/generate-book";

function buildErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The archives refused to open. Try again.";

  if (isDevOrPreview()) {
    return NextResponse.json(
      {
        error: message,
        debug: {
          name: error instanceof Error ? error.name : "Error",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: "The archives refused to open. Try again." }, { status: 500 });
}

export async function POST(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

  try {
    const body = await request.json();
    const { input, approvedSynopsis, error } = validateGenerateBookRequest(body);
    if (!input) {
      return NextResponse.json({ error: error || "Invalid input." }, { status: 400 });
    }

    const loreResult = await generateLoreBook(input, approvedSynopsis);
    const storedBook = await createFreeBook(input, loreResult.book, approvedSynopsis ?? null);
    const accessToken = storedBook.access_token;
    const updatedStoredBook = await generateFreeBookImages(accessToken, loreResult.book);

    const mergedBook = await mergeBookAssets(loreResult.book, updatedStoredBook.images, updatedStoredBook.audio);
    const book = normalizeBook(mergedBook);
    if (!book) {
      throw new Error("The generated book could not be prepared for reading.");
    }

    logRouteSuccess(ROUTE_NAME);

    return NextResponse.json({
      success: true,
      bookId: storedBook.id,
      accessToken,
      status: updatedStoredBook.status,
      readyImagesCount: getReadyIllustrationCount({
        images: updatedStoredBook.images,
        imageStatus: updatedStoredBook.image_status,
        pages: book.pages,
      }),
      fallback: loreResult.fallback,
    });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "The archives refused to open. Try again.");
    return response ?? buildErrorResponse(error);
  }
}
