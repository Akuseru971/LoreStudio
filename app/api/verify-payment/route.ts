import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { maybeSendPaymentConfirmationEmail } from "@/lib/confirmationEmail";
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

    await maybeSendPaymentConfirmationEmail(result.book.id).catch((error) => {
      console.error("[PAYMENT_EMAIL_FAILED]", {
        bookId: result.book.id,
        error: error instanceof Error ? error.message : error,
      });
    });

    const book = (await getBookByAccessToken(body.accessToken)) || result.book;

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
      confirmationEmailSent: book.payment_email_status === "sent",
      confirmationEmailSkipped: book.payment_email_status === "skipped",
      confirmationEmailFailed: book.payment_email_status === "failed",
      recoveryEmailAvailable: Boolean(book.email) || book.payment_email_status === "sent",
    });
  } catch (error) {
    console.error("Payment verification failed.", error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
