/**
 * Vidéo jouée au lancement du rituel de génération.
 *
 * Configuration (une des options) :
 * - RITUAL_LAUNCH_VIDEO_URL (serveur, recommandé pour Blob privé signé)
 * - NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO (URL complète, proxifiée via /api/ritual-video)
 * - Fichier local : public/video/ritual-launch.mp4
 */
export const RITUAL_LAUNCH_VIDEO_PATH =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() || "/video/ritual-launch.mp4";

export function isExternalRitualVideoUrl(url: string = RITUAL_LAUNCH_VIDEO_PATH) {
  return /^https?:\/\//i.test(url);
}

export function isRitualLaunchVideoConfigured() {
  return Boolean(
    process.env.RITUAL_LAUNCH_VIDEO_URL?.trim() ||
      process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim(),
  );
}

/** URL utilisée par le lecteur <video> côté client */
export function getRitualLaunchVideoSrc() {
  if (isRitualLaunchVideoConfigured() || isExternalRitualVideoUrl()) {
    return "/api/ritual-video";
  }
  return "/video/ritual-launch.mp4";
}

export function shouldProxyRitualVideo() {
  return getRitualLaunchVideoSrc() === "/api/ritual-video";
}
