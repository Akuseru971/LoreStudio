import { NextResponse } from "next/server";
import {
  isClientConnectionClosedError,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
} from "@/lib/api-route-utils";
import { getRitualLaunchVideoUrl } from "@/lib/video-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getConfiguredVideoUrl() {
  return (
    getRitualLaunchVideoUrl(false) ||
    getRitualLaunchVideoUrl(true) ||
    process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
    process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() ||
    ""
  );
}

/**
 * Legacy endpoint — returns a direct CDN URL instead of proxying video bytes.
 * The browser should load video from storage/CDN directly.
 */
export async function GET(request: Request) {
  const routeName = "/api/ritual-video";
  logRouteStart(routeName, request);

  if (request.signal.aborted) {
    logClientConnectionClosed(routeName);
    return clientConnectionClosedResponse();
  }

  try {
    const videoUrl = getConfiguredVideoUrl();
    if (!videoUrl) {
      return NextResponse.json({ error: "Video not configured." }, { status: 404 });
    }

    logRouteSuccess(routeName);
    return NextResponse.json(
      { url: videoUrl },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(routeName);
      return clientConnectionClosedResponse();
    }

    logRouteError(routeName, error);
    return NextResponse.json({ error: "Video fetch failed." }, { status: 502 });
  }
}

export async function HEAD(request: Request) {
  const routeName = "/api/ritual-video";
  logRouteStart(routeName, request);

  const videoUrl = getConfiguredVideoUrl();
  if (!videoUrl) {
    return new Response(null, { status: 404 });
  }

  logRouteSuccess(routeName);
  return new Response(null, {
    status: 200,
    headers: {
      "X-Ritual-Video-Url": videoUrl,
      "Cache-Control": "private, max-age=300",
    },
  });
}
