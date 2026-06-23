import { NextResponse } from "next/server";
import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
import { isValidInternalFulfillmentRequest } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SendEmailBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  if (!isValidInternalFulfillmentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SendEmailBody = {};

  try {
    body = (await request.json()) as SendEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await sendConfirmationEmailIfNeeded(body.accessToken);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[BOOK_READY_EMAIL_FAILED]", error);
    const message = error instanceof Error ? error.message : "Unable to send ready email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
