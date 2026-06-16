export const AMBIENT_MUSIC_URL = process.env.NEXT_PUBLIC_AMBIENT_MUSIC_URL?.trim() || "";

export const AMBIENT_MUSIC_MUTED_KEY = "lore-studio-ambient-music-muted";

export function isAmbientMusicConfigured() {
  return Boolean(AMBIENT_MUSIC_URL);
}

export function readAmbientMusicMutedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(AMBIENT_MUSIC_MUTED_KEY) === "true";
}

export function writeAmbientMusicMutedPreference(muted: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AMBIENT_MUSIC_MUTED_KEY, String(muted));
}
