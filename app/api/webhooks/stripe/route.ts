import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getBookByAccessToken,
  getBookById,
  saveEmail,
  saveStripePayment,
  updateBookStatus,
  updateGenerationProgress,
} from "@/lib/bookStore";
import { maybeSendPaymentConfirmationEmail } from "@/lib/confirmationEmail";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

function getSessionMetadataValue(session: Stripe.Checkout.Session, ...keys: string[]) {
  for (const key of keys) {
    const value = session.metadata?.[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed.", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  console.log("[STRIPE_WEBHOOK_RECEIVED]", {
    type: event.type,
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookId = getSessionMetadataValue(session, "bookId", "book_id");
      const accessToken = getSessionMetadataValue(session, "accessToken", "access_token");

      if (!bookId) {
        console.error("[CHECKOUT_COMPLETED]", {
          sessionId: session.id,
          error: "missing_book_id",
          hasAccessToken: Boolean(accessToken),
        });
      }

      if (!bookId && !accessToken) {
        return NextResponse.json({ received: true });
      }

      if (session.payment_status !== "paid") {
        console.warn("[CHECKOUT_COMPLETED]", {
          sessionId: session.id,
          bookId,
          error: "payment_not_paid",
        });
        return NextResponse.json({ received: true });
      }

      let storedBook = bookId ? await getBookById(bookId) : null;
      if (!storedBook && accessToken) {
        storedBook = await getBookByAccessToken(accessToken);
      }

      if (!storedBook) {
        console.error("[CHECKOUT_COMPLETED]", {
          sessionId: session.id,
          bookId,
          accessToken,
          error: "book_not_found",
        });
        return NextResponse.json({ received: true });
      }

      if (bookId && storedBook.id !== bookId) {
        console.error("[CHECKOUT_COMPLETED]", {
          sessionId: session.id,
          bookId,
          error: "book_id_mismatch",
        });
        return NextResponse.json({ received: true });
      }

      if (accessToken && storedBook.access_token !== accessToken) {
        console.error("[CHECKOUT_COMPLETED]", {
          sessionId: session.id,
          bookId: storedBook.id,
          error: "access_token_mismatch",
        });
        return NextResponse.json({ received: true });
      }

      const customerEmail =
        session.customer_details?.email || session.customer_email || storedBook.email || null;

      console.log("[CHECKOUT_COMPLETED]", {
        sessionId: session.id,
        bookId: storedBook.id,
        hasCustomerEmail: Boolean(customerEmail),
      });

      if (customerEmail) {
        await saveEmail(storedBook.id, customerEmail);
      }

      await saveStripePayment(
        storedBook.id,
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
        customerEmail,
      );

      if (!hasPremiumAccess(storedBook.status)) {
        await updateBookStatus(storedBook.id, "paid");
        await updateGenerationProgress(storedBook.id, "preparing", { touchStartedAt: true });
        console.log("[BOOK_MARKED_PAID]", {
          bookId: storedBook.id,
        });
      }

      console.log("[PAYMENT_CONFIRMED_TRIGGER_EMAIL]", {
        bookId: storedBook.id,
      });

      try {
        await maybeSendPaymentConfirmationEmail(storedBook.id);
      } catch (error) {
        console.error("[PAYMENT_EMAIL_FAILED]", {
          bookId: storedBook.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler failed.", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
