import { NextResponse } from "next/server";
import { generatePremiumImages } from "@/lib/premiumImages";

export const runtime = "nodejs";
export const maxDuration = 300;

type RetryMissingImagesBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  let body: RetryMissingImagesBody = {};

  try {
    body = (await request.json()) as RetryMissingImagesBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await generatePremiumImages(body.accessToken);
    return NextResponse.json({
      images: result.images,
      allReady: result.allReady,
    });
  } catch (error) {
    console.error("Retry missing images failed.", error);
    const message = error instanceof Error ? error.message : "Unable to retry missing images.";
    const status = message.includes("Premium access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
