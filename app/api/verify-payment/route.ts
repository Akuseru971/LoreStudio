import { NextResponse } from "next/server";
import { hasPremiumAccess, verifyStripeCheckoutSession } from "@/lib/paymentVerification";
import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";

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
    const emailResult = await sendConfirmationEmailIfNeeded(body.accessToken);

    return NextResponse.json({
      verified: result.verified,
      alreadyUnlocked: result.alreadyUnlocked,
      status: book.status,
      isPremium: hasPremiumAccess(book.status),
      canDownloadPdf: hasPremiumAccess(book.status),
      canDownloadMp3: hasPremiumAccess(book.status),
      accessToken: book.access_token,
      confirmationEmailSent: emailResult.sent,
      confirmationEmailSkipped: emailResult.skipped,
      recoveryEmailAvailable: Boolean(
        emailResult.recoveryEmailAvailable ?? emailResult.sent ?? emailResult.reason === "already_sent",
      ),
    });
  } catch (error) {
    console.error("Payment verification failed.", error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
