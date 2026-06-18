import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getBookByAccessToken, saveEmail, saveStripePayment, updateBookStatus } from "@/lib/bookStore";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function triggerFulfillment(accessToken: string) {
  const secret = process.env.INTERNAL_FULFILLMENT_SECRET;
  if (!secret) {
    console.warn("INTERNAL_FULFILLMENT_SECRET is not configured. Skipping async fulfillment trigger.");
    return;
  }

  await fetch(`${getAppUrl()}/api/fulfill-book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      secret,
    }),
  }).catch((error) => {
    console.error("Failed to trigger fulfillment job.", error);
  });
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

      const storedBook = await getBookByAccessToken(accessToken);
      if (!storedBook) {
        console.warn("Checkout completed for unknown access token.", accessToken);
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
      await updateBookStatus(storedBook.id, "paid");
      void triggerFulfillment(accessToken);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler failed.", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
