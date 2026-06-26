import { NextResponse } from "next/server";
import { findPaidBooksWithIncompletePremiumGeneration, getBookByAccessToken } from "@/lib/bookStore";
import {
  generateNextPremiumImage,
  getMissingPremiumImagePages,
  getPremiumGenerationStatus,
  recoverStalePremiumImages,
} from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type ResumeStuckBooksBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  const secret = request.headers.get("x-internal-fulfillment-secret");

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResumeStuckBooksBody = {};

  try {
    body = (await request.json()) as ResumeStuckBooksBody;
  } catch {
    body = {};
  }

  try {
    const candidates = body.accessToken
      ? [(await getBookByAccessToken(body.accessToken))].filter(Boolean)
      : await findPaidBooksWithIncompletePremiumGeneration(1);

    if (candidates.length === 0) {
      return NextResponse.json({
        resumed: false,
        reason: "no_stuck_books",
      });
    }

    const storedBook = candidates[0]!;
    if (!hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({
        resumed: false,
        reason: "not_premium",
        bookId: storedBook.id,
      });
    }

    const recoveredBook = (await recoverStalePremiumImages(storedBook)) || storedBook;
    const status = getPremiumGenerationStatus(recoveredBook);
    const missingPremiumPages = getMissingPremiumImagePages(recoveredBook);

    if (missingPremiumPages.length === 0) {
      return NextResponse.json({
        resumed: false,
        reason: "all_premium_images_ready",
        bookId: recoveredBook.id,
      });
    }

    console.log("[PREMIUM_GENERATION_STATUS]", {
      bookId: recoveredBook.id,
      readyImagesCount: status.readyImagesCount,
      missingPremiumPages: status.missingPremiumPages,
      stalePremiumPages: status.stalePremiumPages,
    });

    const result = await generateNextPremiumImage(recoveredBook.access_token);

    return NextResponse.json({
      resumed: true,
      bookId: recoveredBook.id,
      accessToken: recoveredBook.access_token,
      generated: result.generated,
      generatedPage: result.pageNumber,
      missingPremiumPages: result.missingPremiumPages,
      stalePremiumPages: result.stalePremiumPages,
      shouldContinuePremiumGeneration: result.shouldContinuePremiumGeneration,
    });
  } catch (error) {
    console.error("[RESUME_STUCK_BOOKS_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unable to resume stuck book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
