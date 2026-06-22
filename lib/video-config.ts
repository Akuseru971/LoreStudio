/**
 * Ritual intro video URLs — always loaded directly from CDN/storage in the browser.
 * Do not proxy video through Next.js API routes.
 *
 * NEXT_PUBLIC_RITUAL_VIDEO_MOBILE — mobile Bunny/CDN URL
 * NEXT_PUBLIC_RITUAL_VIDEO_DESKTOP — desktop Bunny/CDN URL
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO — fallback URL for any viewport
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO_POSTER — optional poster image
 */
export const RITUAL_LAUNCH_VIDEO_POSTER =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO_POSTER?.trim() || undefined;

const FALLBACK_RITUAL_VIDEO_URL =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() ||
  process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
  "";

const MOBILE_RITUAL_VIDEO_URL = process.env.NEXT_PUBLIC_RITUAL_VIDEO_MOBILE?.trim() || "";
const DESKTOP_RITUAL_VIDEO_URL = process.env.NEXT_PUBLIC_RITUAL_VIDEO_DESKTOP?.trim() || "";

export function isRitualLaunchVideoConfigured() {
  return Boolean(MOBILE_RITUAL_VIDEO_URL || DESKTOP_RITUAL_VIDEO_URL || FALLBACK_RITUAL_VIDEO_URL);
}

export function getRitualLaunchVideoUrl(isMobile = false) {
  if (isMobile) {
    return MOBILE_RITUAL_VIDEO_URL || FALLBACK_RITUAL_VIDEO_URL || DESKTOP_RITUAL_VIDEO_URL || null;
  }

  return DESKTOP_RITUAL_VIDEO_URL || FALLBACK_RITUAL_VIDEO_URL || MOBILE_RITUAL_VIDEO_URL || null;
}

/** Direct CDN URL for the ritual video player — never use /api/ritual-video. */
export function getRitualLaunchVideoSrc(isMobile = false): string | null {
  return getRitualLaunchVideoUrl(isMobile);
}

/** @deprecated Use RitualVideoPreloader during the form step instead */
export function prefetchRitualLaunchVideo(isMobile = false) {
  if (typeof window === "undefined" || !isRitualLaunchVideoConfigured()) {
    return () => {};
  }

  const src = getRitualLaunchVideoSrc(isMobile);
  if (!src) {
    return () => {};
  }

  const existing = document.querySelector<HTMLLinkElement>(`link[data-ritual-video-prefetch="${src}"]`);
  if (existing) {
    return () => {};
  }

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "video";
  link.href = src;
  link.setAttribute("data-ritual-video-prefetch", src);
  document.head.appendChild(link);

  return () => {
    link.remove();
  };
}
