import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { sendPaymentConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
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
    const paidBook = (await getBookByAccessToken(body.accessToken)) || result.book;

    console.log("[PAYMENT_CONFIRMATION_EMAIL_TRIGGER_FROM_VERIFY_PAYMENT]", {
      bookId: paidBook.id,
      status: paidBook.status,
      alreadyUnlocked: result.alreadyUnlocked,
    });

    const emailResult = await sendPaymentConfirmationEmailIfNeeded(paidBook.id);

    const refreshedBook = (await getBookByAccessToken(body.accessToken)) || paidBook;
    const trackingSent =
      refreshedBook.payment_email_status === "sent" || refreshedBook.confirmation_email_status === "sent";
    const trackingSkipped =
      refreshedBook.payment_email_status === "skipped" || refreshedBook.confirmation_email_status === "skipped";
    const trackingFailed =
      refreshedBook.payment_email_status === "failed" || refreshedBook.confirmation_email_status === "failed";

    if (hasPremiumAccess(refreshedBook.status)) {
      console.log("[PAYMENT_VERIFIED_START_PREMIUM_GENERATION]");
    }

    return NextResponse.json({
      verified: result.verified,
      alreadyUnlocked: result.alreadyUnlocked,
      status: refreshedBook.status,
      isPremium: hasPremiumAccess(refreshedBook.status),
      canDownloadPdf: hasPremiumAccess(refreshedBook.status),
      canDownloadMp3: hasPremiumAccess(refreshedBook.status),
      accessToken: refreshedBook.access_token,
      confirmationEmailSent: trackingSent || emailResult.sent,
      confirmationEmailSkipped: trackingSkipped || emailResult.skipped,
      confirmationEmailFailed: trackingFailed || emailResult.failed,
      recoveryEmailAvailable: Boolean(refreshedBook.email) || trackingSent || emailResult.sent,
    });
  } catch (error) {
    console.error("Payment verification failed.", error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
