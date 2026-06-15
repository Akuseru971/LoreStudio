"use client";

import { isAmbientMusicConfigured } from "@/lib/ambient-music-config";

type AmbientMusicToggleProps = {
  muted: boolean;
  onToggle: () => void;
};

function MusicOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ambient-music-toggle-icon">
      <path
        d="M12 3.5 7.5 7H4v10h3.5L12 20.5V3.5zm4.2 3.8a7 7 0 010 9.8 1 1 0 11-1.4-1.42 5 5 0 000-7.06 1 1 0 111.4-1.42zm2.8-2.8a10.5 10.5 0 010 14.84 1 1 0 11-1.4-1.42 8.5 8.5 0 000-12 1 1 0 111.4-1.42z"
        fill="currentColor"
      />
    </svg>
  );
}

function MusicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ambient-music-toggle-icon">
      <path
        d="M16.5 12a4.5 4.5 0 00-2.5-4.03v7.06A4.48 4.48 0 0016.5 12zM19 12c0 1.48-.37 2.87-1.02 4.08l1.5 1.5A9.96 9.96 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AmbientMusicToggle({ muted, onToggle }: AmbientMusicToggleProps) {
  if (!isAmbientMusicConfigured()) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="ambient-music-toggle"
      aria-label={muted ? "Unmute ambient music" : "Mute ambient music"}
      aria-pressed={muted}
      title={muted ? "Unmute ambient music" : "Mute ambient music"}
    >
      {muted ? <MusicOffIcon /> : <MusicOnIcon />}
    </button>
  );
}
