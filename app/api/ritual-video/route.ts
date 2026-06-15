import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getConfiguredVideoUrl() {
  return (
    process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
    process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() ||
    ""
  );
}

async function fetchUpstreamVideo(request: Request) {
  const videoUrl = getConfiguredVideoUrl();
  if (!videoUrl) {
    return null;
  }

  const range = request.headers.get("range");
  const upstream = await fetch(videoUrl, {
    headers: range ? { Range: range } : undefined,
  });

  return { upstream, videoUrl };
}

export async function GET(request: Request) {
  try {
    const result = await fetchUpstreamVideo(request);
    if (!result) {
      return NextResponse.json({ error: "Video not configured." }, { status: 404 });
    }

    const { upstream } = result;
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Video unavailable." }, { status: upstream.status || 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");

    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Ritual video proxy failed.", error);
    return NextResponse.json({ error: "Video fetch failed." }, { status: 502 });
  }
}

export async function HEAD() {
  try {
    const videoUrl = getConfiguredVideoUrl();
    if (!videoUrl) {
      return new Response(null, { status: 404 });
    }

    const upstream = await fetch(videoUrl, { method: "HEAD" });
    return new Response(null, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
