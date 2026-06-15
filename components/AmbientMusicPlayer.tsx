"use client";

import { useEffect, useRef } from "react";
import { AMBIENT_MUSIC_URL, isAmbientMusicConfigured } from "@/lib/ambient-music-config";

export type AmbientMusicPlayerProps = {
  shouldPlay: boolean;
};

const TARGET_VOLUME = 0.16;
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 1000;

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  fadeIdRef: { current: number },
  nextFadeId: number,
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();

    const step = (now: number) => {
      if (fadeIdRef.current !== nextFadeId) {
        resolve();
        return;
      }

      const progress = Math.min(1, (now - start) / durationMs);
      audio.volume = from + (to - from) * progress;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

export default function AmbientMusicPlayer({ shouldPlay }: AmbientMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIdRef = useRef(0);
  const playingRef = useRef(false);

  useEffect(() => {
    if (!isAmbientMusicConfigured()) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let cancelled = false;
    const fadeId = ++fadeIdRef.current;

    const run = async () => {
      if (shouldPlay) {
        if (playingRef.current && !audio.paused) {
          return;
        }

        audio.loop = true;
        audio.volume = 0;

        try {
          await audio.play();
        } catch {
          playingRef.current = false;
          return;
        }

        if (cancelled || fadeIdRef.current !== fadeId) {
          return;
        }

        playingRef.current = true;
        await fadeVolume(audio, 0, TARGET_VOLUME, FADE_IN_MS, fadeIdRef, fadeId);

        if (cancelled || fadeIdRef.current !== fadeId) {
          return;
        }

        audio.volume = TARGET_VOLUME;
        return;
      }

      if (!playingRef.current && audio.paused) {
        return;
      }

      const startVolume = audio.volume;
      await fadeVolume(audio, startVolume, 0, FADE_OUT_MS, fadeIdRef, fadeId);

      if (cancelled || fadeIdRef.current !== fadeId) {
        return;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
      playingRef.current = false;
    };

    void run();

    return () => {
      cancelled = true;
      fadeIdRef.current += 1;
    };
  }, [shouldPlay]);

  useEffect(() => {
    return () => {
      fadeIdRef.current += 1;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.volume = 0;
      }
      playingRef.current = false;
    };
  }, []);

  if (!isAmbientMusicConfigured()) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      src={AMBIENT_MUSIC_URL}
      preload="auto"
      loop
      aria-hidden="true"
      className="sr-only"
    />
  );
}
