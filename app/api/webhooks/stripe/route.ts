import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getBookByAccessToken, saveEmail, saveStripePayment, updateBookStatus, updateGenerationProgress } from "@/lib/bookStore";
import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const accessToken = session.metadata?.access_token;

      if (!accessToken) {
        console.warn("Checkout session completed without access_token metadata.");
        return NextResponse.json({ received: true });
      }

      if (session.payment_status !== "paid") {
        console.warn("Checkout session completed without paid status.", session.id);
        return NextResponse.json({ received: true });
      }

      const storedBook = await getBookByAccessToken(accessToken);
      if (!storedBook) {
        console.warn("Checkout completed for unknown access token.", accessToken);
        return NextResponse.json({ received: true });
      }

      if (session.metadata?.book_id && session.metadata.book_id !== storedBook.id) {
        console.warn("Checkout session book_id mismatch.", session.id);
        return NextResponse.json({ received: true });
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

      if (!hasPremiumAccess(storedBook.status)) {
        await updateBookStatus(storedBook.id, "paid");
        await updateGenerationProgress(storedBook.id, "preparing", { touchStartedAt: true });
        console.log("[PAYMENT_VERIFIED]", { bookId: storedBook.id, accessToken });
      }

      void sendConfirmationEmailIfNeeded(accessToken).catch((error) => {
        console.error("[BOOK_UNLOCKED_EMAIL_FAILED]", error);
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler failed.", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
