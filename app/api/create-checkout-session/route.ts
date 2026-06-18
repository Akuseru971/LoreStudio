import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

type CheckoutRequestBody = {
  bookTitle?: string;
  characterName?: string;
};

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
      { status: 503 },
    );
  }

  let body: CheckoutRequestBody = {};
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    body = {};
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      metadata: {
        bookTitle: body.bookTitle?.slice(0, 120) || "",
        characterName: body.characterName?.slice(0, 120) || "",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
