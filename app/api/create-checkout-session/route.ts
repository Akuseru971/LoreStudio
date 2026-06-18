import { NextResponse } from "next/server";
import { getBookByAccessToken, saveStripeSession } from "@/lib/bookStore";
import { getStripeClient } from "@/lib/stripe";

type CheckoutRequestBody = {
  accessToken?: string;
  email?: string;
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

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing book access token." }, { status: 400 });
  }

  try {
    const storedBook = await getBookByAccessToken(body.accessToken);
    if (!storedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const characterName =
      storedBook.free_book?.characterBible.name || storedBook.form_input.name || "your champion";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/success?token=${encodeURIComponent(storedBook.access_token)}`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      customer_email: body.email || storedBook.email || undefined,
      metadata: {
        access_token: storedBook.access_token,
        book_id: storedBook.id,
        character_name: characterName.slice(0, 120),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    await saveStripeSession(storedBook.id, session.id, "checkout_started");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
