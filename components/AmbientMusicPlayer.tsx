"use client";

import { useEffect, useRef } from "react";
import { AMBIENT_MUSIC_URL, isAmbientMusicConfigured } from "@/lib/ambient-music-config";
import { NARRATION_END_EVENT, NARRATION_START_EVENT } from "@/lib/narration-events";

export type AmbientMusicPlayerProps = {
  shouldPlay: boolean;
  normalVolume?: number;
};

const DEFAULT_NORMAL_VOLUME = 0.12;
const DUCKED_VOLUME = 0.05;
const FADE_IN_MS = 1800;
const FADE_OUT_MS = 1000;
const VOLUME_TRANSITION_MS = 600;

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  fadeIdRef: { current: number },
  fadeId: number,
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();

    const step = (now: number) => {
      if (fadeIdRef.current !== fadeId) {
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

export default function AmbientMusicPlayer({
  shouldPlay,
  normalVolume = DEFAULT_NORMAL_VOLUME,
}: AmbientMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIdRef = useRef(0);
  const playingRef = useRef(false);
  const duckedRef = useRef(false);
  const normalVolumeRef = useRef(normalVolume);

  useEffect(() => {
    normalVolumeRef.current = normalVolume;
    const audio = audioRef.current;
    if (!audio || audio.paused || duckedRef.current) {
      return;
    }
    audio.volume = normalVolume;
  }, [normalVolume]);

  useEffect(() => {
    if (!isAmbientMusicConfigured()) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const transitionTo = async (targetVolume: number) => {
      if (audio.paused) {
        return;
      }
      const fadeId = ++fadeIdRef.current;
      const startVolume = audio.volume;
      await fadeVolume(audio, startVolume, targetVolume, VOLUME_TRANSITION_MS, fadeIdRef, fadeId);
      if (fadeIdRef.current === fadeId) {
        audio.volume = targetVolume;
      }
    };

    const handleNarrationStart = () => {
      duckedRef.current = true;
      void transitionTo(DUCKED_VOLUME);
    };

    const handleNarrationEnd = () => {
      duckedRef.current = false;
      if (shouldPlay) {
        void transitionTo(normalVolumeRef.current);
      }
    };

    window.addEventListener(NARRATION_START_EVENT, handleNarrationStart);
    window.addEventListener(NARRATION_END_EVENT, handleNarrationEnd);

    return () => {
      window.removeEventListener(NARRATION_START_EVENT, handleNarrationStart);
      window.removeEventListener(NARRATION_END_EVENT, handleNarrationEnd);
    };
  }, [shouldPlay]);

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
          if (!duckedRef.current) {
            audio.volume = normalVolumeRef.current;
          }
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
        const targetVolume = duckedRef.current ? DUCKED_VOLUME : normalVolumeRef.current;
        await fadeVolume(audio, 0, targetVolume, FADE_IN_MS, fadeIdRef, fadeId);

        if (cancelled || fadeIdRef.current !== fadeId) {
          return;
        }

        audio.volume = targetVolume;
        return;
      }

      duckedRef.current = false;

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
      duckedRef.current = false;
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
