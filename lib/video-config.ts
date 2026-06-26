/**
 * Ritual intro video — one direct CDN URL for all viewports.
 * Never proxy video through Next.js API routes.
 *
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO — Bunny/CDN URL
 * NEXT_PUBLIC_RITUAL_VIDEO_POSTER — optional poster image
 *
 * The ritual video file must be web-optimized:
 * - MP4 H.264
 * - AAC audio
 * - faststart enabled (moov atom at the beginning)
 * - reasonable file size
 * - CDN must support range requests
 *
 * Recommended ffmpeg command:
 * ffmpeg -i input.mp4 -vf "scale=-2:720" -r 30 -c:v libx264 -preset slow -crf 26 -movflags +faststart -c:a aac -b:a 128k ritual.mp4
 *
 * If playback still fails after code fixes, re-encode with the command above and upload to Bunny.
 */

const DEFAULT_RITUAL_VIDEO_URL = "https://video-invocation.b-cdn.net/0613.mp4";

export const RITUAL_LAUNCH_VIDEO_POSTER =
  process.env.NEXT_PUBLIC_RITUAL_VIDEO_POSTER?.trim() ||
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO_POSTER?.trim() ||
  undefined;

export function getRitualVideoUrl() {
  const url =
    process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() ||
    process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
    DEFAULT_RITUAL_VIDEO_URL;

  if (!url || url.startsWith("/api/")) {
    console.error("[INVALID_RITUAL_VIDEO_SOURCE]", url);
    return DEFAULT_RITUAL_VIDEO_URL;
  }

  if (typeof window !== "undefined") {
    console.log("[RITUAL_VIDEO_URL]", url);
  }

  return url;
}

export function isDirectRitualVideoUrl(url: string | null | undefined): url is string {
  if (!url || url.startsWith("/api/")) {
    return false;
  }

  return /^https?:\/\//i.test(url);
}

export function isRitualLaunchVideoConfigured() {
  return isDirectRitualVideoUrl(getRitualVideoUrl());
}

/** @deprecated Use getRitualVideoUrl() */
export function getRitualLaunchVideoSrc() {
  return getRitualVideoUrl();
}

/** @deprecated Use getRitualVideoUrl() */
export function getRitualLaunchVideoUrl() {
  return getRitualVideoUrl();
}
