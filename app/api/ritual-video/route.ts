import { NextResponse } from "next/server";
import { getRitualLaunchVideoUrl } from "@/lib/video-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint — video must never be streamed through Vercel.
 * Returns the direct CDN URL as JSON only.
 */
export async function GET() {
  const videoUrl = getRitualLaunchVideoUrl(false) || getRitualLaunchVideoUrl(true);

  return NextResponse.json(
    {
      error: "Video must be loaded directly from CDN",
      videoUrl: videoUrl || null,
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
