import { NextResponse } from "next/server";
import { getRitualVideoUrl } from "@/lib/video-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint — video must never be streamed through Vercel.
 * Returns the direct CDN URL as JSON only.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Video must be loaded directly from CDN",
      videoUrl: getRitualVideoUrl(),
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
