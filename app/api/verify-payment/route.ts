import { NextResponse } from "next/server";
import { hasPremiumAccess, triggerGenerateNextPremiumImage, verifyStripeCheckoutSession } from "@/lib/paymentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const ROUTE_NAME = "/api/verify-payment";

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
      void triggerGenerateNextPremiumImage(body.accessToken);
    }

    return NextResponse.json({
      verified: result.verified,
      alreadyUnlocked: result.alreadyUnlocked,
      status: book.status,
      isPremium: hasPremiumAccess(book.status),
      canDownloadPdf: false,
      canDownloadMp3: hasPremiumAccess(book.status),
      accessToken: book.access_token,
      confirmationEmailSent: false,
      confirmationEmailSkipped: true,
      confirmationEmailFailed: false,
      recoveryEmailAvailable: false,
      preparingAssets: book.status === "preparing_assets" || book.status === "paid",
    });
  } catch (error) {
    console.error(`${ROUTE_NAME} failed.`, error);
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
