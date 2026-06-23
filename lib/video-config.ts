/**
 * Ritual intro video — one direct CDN URL for all viewports.
 * Never proxy video through Next.js API routes.
 *
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO — Bunny/CDN URL
 * NEXT_PUBLIC_RITUAL_VIDEO_POSTER — optional poster image
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
