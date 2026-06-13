/**
 * Chemin public de la vidéo jouée au lancement du rituel de génération.
 * Placez votre fichier dans `public/video/` (ex. `public/video/ritual-launch.mp4`).
 */
export const RITUAL_LAUNCH_VIDEO_PATH =
  process.env.NEXT_PUBLIC_RITUAL_LAUNCH_VIDEO?.trim() || "/video/ritual-launch.mp4";
