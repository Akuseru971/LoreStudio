import { NextResponse } from "next/server";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { finalizeBookIfReady } from "@/lib/bookCompletion";
import { hasPremiumAccess, verifyStripeCheckoutSession } from "@/lib/paymentVerification";
import { triggerPremiumImageGeneration } from "@/lib/premiumImages";

export const runtime = "nodejs";

type VerifyPaymentBody = {
  accessToken?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  let body: VerifyPaymentBody = {};

  try {
    body = (await request.json()) as VerifyPaymentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken || !body.sessionId) {
    return NextResponse.json({ error: "Missing access token or session ID." }, { status: 400 });
  }

  try {
    const result = await verifyStripeCheckoutSession(body.accessToken, body.sessionId);
    const book = result.book;
    const normalized = getNormalizedImagesForStoredBook(book);
    const isPremium = hasPremiumAccess(book.status);

    if (isPremium) {
      triggerPremiumImageGeneration(body.accessToken);
    }

    return NextResponse.json({
      verified: result.verified,
      alreadyUnlocked: result.alreadyUnlocked,
      status: book.status,
      isPremium,
      canDownloadPdf: isPremium && normalized.allIllustrationsReady,
      canDownloadMp3: isPremium,
      accessToken: book.access_token,
      readyIllustrationCount: normalized.readyIllustrationCount,
      allIllustrationsReady: normalized.allIllustrationsReady,
      confirmationEmailSent: false,
      confirmationEmailSkipped: true,
      confirmationEmailFailed: false,
      recoveryEmailAvailable: Boolean(book.confirmation_email_sent_at),
    });
  } catch (error) {
    console.error("Payment verification failed.", error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
