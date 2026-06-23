import { NextResponse } from "next/server";
import { checkBookReadyAndFinalize } from "@/lib/bookCompletion";
import { isValidInternalFulfillmentRequest } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CheckBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  if (!isValidInternalFulfillmentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckBody = {};

  try {
    body = (await request.json()) as CheckBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await checkBookReadyAndFinalize(body.accessToken);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[BOOK_READY_CHECK_FAILED]", error);
    const message = error instanceof Error ? error.message : "Unable to check book readiness.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
