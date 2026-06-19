/**
 * Vidéo d'ouverture du rituel de génération.
 *
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO — URL externe (ex. Vercel Blob)
 * RITUAL_LAUNCH_VIDEO_URL — alternative serveur (proxy /api/ritual-video)
 * NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO_POSTER — image poster optionnelle
 */
export const RITUAL_LAUNCH_VIDEO_URL =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() ||
  process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
  "";

export const RITUAL_LAUNCH_VIDEO_POSTER =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO_POSTER?.trim() || undefined;

export function isRitualLaunchVideoConfigured() {
  return Boolean(RITUAL_LAUNCH_VIDEO_URL);
}

/** Src du lecteur — proxy pour URLs externes afin d'éviter les blocages CORS/403 */
export function getRitualLaunchVideoSrc(): string | null {
  if (!isRitualLaunchVideoConfigured()) {
    return null;
  }
  return "/api/ritual-video";
}

/** @deprecated Use RitualVideoPreloader during the form step instead */
export function prefetchRitualLaunchVideo() {
  if (typeof window === "undefined" || !isRitualLaunchVideoConfigured()) {
    return () => {};
  }

  const src = getRitualLaunchVideoSrc();
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
