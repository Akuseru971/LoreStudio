import { NextResponse } from "next/server";
import { fulfillPremiumBook } from "@/lib/premiumFulfillment";

export const runtime = "nodejs";
export const maxDuration = 300;

type FulfillBody = {
  accessToken?: string;
  secret?: string;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  let body: FulfillBody = {};

  try {
    body = (await request.json()) as FulfillBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!expectedSecret || body.secret !== expectedSecret || !body.accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const book = await fulfillPremiumBook(body.accessToken);
    return NextResponse.json({ status: book.status, accessToken: book.access_token });
  } catch (error) {
    console.error("Premium fulfillment failed.", error);
    const message = error instanceof Error ? error.message : "Fulfillment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
