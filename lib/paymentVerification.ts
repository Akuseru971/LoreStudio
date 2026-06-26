import {
  getBookByAccessToken,
  saveEmail,
  saveStripePayment,
  updateBookStatus,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { getStripeClient } from "@/lib/stripe";
import type { BookStatus, StoredBook } from "@/lib/types";

const PREMIUM_STATUSES: BookStatus[] = ["paid", "generating", "ready"];

export function hasPremiumAccess(status: BookStatus) {
  return PREMIUM_STATUSES.includes(status);
}

export async function triggerFulfillment(_accessToken: string) {
  console.log("[FULFILLMENT_DEFERRED_TO_CLIENT]");
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
    const refreshedBook = await getBookByAccessToken(accessToken);

    return {
      verified: true,
      alreadyUnlocked: true,
      book: refreshedBook || storedBook,
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new Error("Payment has not been completed.");
  }

  const sessionAccessToken =
    session.metadata?.accessToken || session.metadata?.access_token || null;
  const sessionBookId = session.metadata?.bookId || session.metadata?.book_id || null;

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
  await updateBookStatus(storedBook.id, "paid");
  await updateGenerationProgress(storedBook.id, "preparing", { touchStartedAt: true });
  console.log("[PAYMENT_VERIFIED]", { bookId: storedBook.id, accessToken });
  console.log("[BOOK_MARKED_PAID]", { bookId: storedBook.id });

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
