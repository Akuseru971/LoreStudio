import {
  getBookByAccessToken,
  saveEmail,
  saveStripePayment,
  updateBookStatus,
} from "@/lib/bookStore";
import { getStripeClient } from "@/lib/stripe";
import type { BookStatus, StoredBook } from "@/lib/types";

const PREMIUM_STATUSES: BookStatus[] = ["paid", "preparing_assets", "generating", "ready"];

export function hasPremiumAccess(status: BookStatus) {
  return PREMIUM_STATUSES.includes(status);
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function triggerFulfillment(accessToken: string) {
  const secret = process.env.INTERNAL_FULFILLMENT_SECRET?.trim();
  if (!secret) {
    console.warn(
      "INTERNAL_FULFILLMENT_SECRET is not configured. Skipping async fulfillment trigger. Premium fulfillment will not run until this secret is set.",
    );
    return;
  }

  await fetch(`${getAppUrl()}/api/internal/fulfill-book`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-fulfillment-secret": secret,
    },
    body: JSON.stringify({ accessToken }),
  }).catch((error) => {
    console.error("Failed to trigger fulfillment job.", error);
  });
}

export type PaymentVerificationResult = {
  verified: boolean;
  alreadyUnlocked: boolean;
  book: StoredBook;
};

export async function verifyStripeCheckoutSession(
  accessToken: string,
  sessionId: string,
): Promise<PaymentVerificationResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (hasPremiumAccess(storedBook.status)) {
    return {
      verified: true,
      alreadyUnlocked: true,
      book: storedBook,
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new Error("Payment has not been completed.");
  }

  const sessionAccessToken = session.metadata?.access_token;
  const sessionBookId = session.metadata?.book_id;

  if (!sessionAccessToken || sessionAccessToken !== accessToken) {
    throw new Error("This payment session does not match the requested book.");
  }

  if (!sessionBookId || sessionBookId !== storedBook.id) {
    throw new Error("This payment session does not match the requested book.");
  }

  const email = session.customer_details?.email || session.customer_email || storedBook.email;
  if (email) {
    await saveEmail(storedBook.id, email);
  }

  await saveStripePayment(
    storedBook.id,
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    email || null,
  );
  await updateBookStatus(storedBook.id, "preparing_assets");
  void triggerFulfillment(accessToken);

  const updatedBook = await getBookByAccessToken(accessToken);
  if (!updatedBook) {
    throw new Error("Book not found after payment verification.");
  }

  return {
    verified: true,
    alreadyUnlocked: false,
    book: updatedBook,
  };
}
