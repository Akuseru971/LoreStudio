/**
 * Vidéo jouée au lancement du rituel de génération.
 *
 * Options :
 * - Fichier local : `/video/ritual-launch.mp4` dans `public/video/`
 * - URL externe (Vercel Blob, CDN…) : URL complète dans NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO
 */
export const RITUAL_LAUNCH_VIDEO_PATH =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() || "/video/ritual-launch.mp4";

export function isExternalRitualVideoUrl(url: string = RITUAL_LAUNCH_VIDEO_PATH) {
  return /^https?:\/\//i.test(url);
}

export function isRitualLaunchVideoConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim());
}
