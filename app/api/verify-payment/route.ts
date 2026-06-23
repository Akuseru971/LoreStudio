import { NextResponse } from "next/server";
import { hasPremiumAccess, verifyStripeCheckoutSession } from "@/lib/paymentVerification";
import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
import { triggerPremiumImageGeneration } from "@/lib/premiumImages";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "/api/verify-payment";

type VerifyPaymentBody = {
  accessToken?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

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

    let emailResult: Awaited<ReturnType<typeof sendConfirmationEmailIfNeeded>> = {
      sent: false,
      skipped: true,
      failed: false,
      reason: "unexpected_error",
      recoveryEmailAvailable: false,
    };

    try {
      emailResult = await sendConfirmationEmailIfNeeded(body.accessToken);
    } catch (error) {
      if (!isClientConnectionClosedError(error)) {
        console.error("[BOOK_UNLOCKED_EMAIL_FAILED]", error);
      }
      emailResult = {
        sent: false,
        skipped: false,
        failed: true,
        reason: "unexpected_error",
        recoveryEmailAvailable: false,
        error: error instanceof Error ? error.message : "Unable to send confirmation email.",
      };
    }

    if (hasPremiumAccess(book.status)) {
      triggerPremiumImageGeneration(body.accessToken);
    }

    logRouteSuccess(ROUTE_NAME);

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
      confirmationEmailFailed: emailResult.failed,
      recoveryEmailAvailable: Boolean(emailResult.recoveryEmailAvailable || emailResult.sent),
    });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "Unable to verify payment.");
    if (response) {
      return response;
    }

    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
