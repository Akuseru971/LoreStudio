import { NextResponse } from "next/server";
import { isValidInternalFulfillmentRequest } from "@/lib/internal-auth";
import { generateNextPremiumImage } from "@/lib/premiumImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GenerateBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  if (!isValidInternalFulfillmentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GenerateBody = {};

  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await generateNextPremiumImage(body.accessToken);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[GENERATE_NEXT_PREMIUM_IMAGE_FAILED]", error);
    const message = error instanceof Error ? error.message : "Unable to generate premium image.";
    const status = message.includes("Premium access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
