import { NextResponse } from "next/server";
import { resumeFreePreviewGeneration } from "@/lib/resumeFreePreviewGeneration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type ResumeFreePreviewBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  const secret = request.headers.get("x-internal-fulfillment-secret");

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResumeFreePreviewBody = {};

  try {
    body = (await request.json()) as ResumeFreePreviewBody;
  } catch {
    body = {};
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await resumeFreePreviewGeneration(body.accessToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PREVIEW_NOTIFY_BACKGROUND_RESUME_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unable to resume free preview generation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
