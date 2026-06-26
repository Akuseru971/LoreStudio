import { NextResponse } from "next/server";
import { verifyStripeCheckoutSession, hasPremiumAccess } from "@/lib/paymentVerification";

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

    if (hasPremiumAccess(book.status)) {
      console.log("[PAYMENT_VERIFIED_START_PREMIUM_GENERATION]");
    }

    return NextResponse.json({
      verified: result.verified,
      alreadyUnlocked: result.alreadyUnlocked,
      status: book.status,
      isPremium: hasPremiumAccess(book.status),
      canDownloadPdf: hasPremiumAccess(book.status),
      canDownloadMp3: hasPremiumAccess(book.status),
      accessToken: book.access_token,
      confirmationEmailSent: book.confirmation_email_status === "sent",
      confirmationEmailSkipped: book.confirmation_email_status === "skipped",
      confirmationEmailFailed: book.confirmation_email_status === "failed",
      recoveryEmailAvailable: Boolean(book.email) || book.confirmation_email_status === "sent",
    });
  } catch (error) {
    console.error("Payment verification failed.", error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
