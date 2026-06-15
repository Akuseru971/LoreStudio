"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import RitualVideoPlayer, { type RitualVideoPlayerHandle } from "@/components/RitualVideoPlayer";

export type RitualLaunchVideoProps = {
  src: string;
  poster?: string;
  onEnded: () => void;
  onSkip: () => void;
};

const SLOW_LOAD_MS = 5000;

export default function RitualLaunchVideo({ src, poster, onEnded, onSkip }: RitualLaunchVideoProps) {
  const playerRef = useRef<RitualVideoPlayerHandle | null>(null);
  const finishedRef = useRef(false);
  const playAttemptedRef = useRef(false);

  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showSoundButton, setShowSoundButton] = useState(false);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const finish = useCallback((handler: () => void) => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    playerRef.current?.pause();
    handler();
  }, []);

  const handleSkip = useCallback(() => finish(onSkip), [finish, onSkip]);
  const handleContinue = useCallback(() => finish(onEnded), [finish, onEnded]);

  const attemptPlay = useCallback(async () => {
    if (finishedRef.current || showContinue || !playerRef.current) {
      return;
    }

    const withSound = await playerRef.current.play(true);
    if (withSound) {
      setIsMuted(false);
      setHasStarted(true);
      setIsBuffering(false);
      setShowSoundButton(false);
      return;
    }

    setIsMuted(true);
    setShowSoundButton(true);

    const mutedPlay = await playerRef.current.play(false);
    if (mutedPlay) {
      setHasStarted(true);
      setIsBuffering(false);
    }
  }, [showContinue]);

  useLayoutEffect(() => {
    if (playAttemptedRef.current) {
      return;
    }
    playAttemptedRef.current = true;
    void attemptPlay();
  }, [attemptPlay]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasStarted && !hasError) {
        setShowSlowMessage(true);
      }
    }, SLOW_LOAD_MS);

    return () => window.clearTimeout(timer);
  }, [hasError, hasStarted]);

  useEffect(() => {
    if (!hasError) {
      return;
    }
    const timer = window.setTimeout(() => handleSkip(), 400);
    return () => window.clearTimeout(timer);
  }, [handleSkip, hasError]);

  const enableSound = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    const ok = await playerRef.current.enableSound();
    if (ok) {
      setIsMuted(false);
      setShowSoundButton(false);
      setHasStarted(true);
      setIsBuffering(false);
      return;
    }

    setIsMuted(true);
    setShowSoundButton(true);
  }, []);

  return (
    <div className="ritual-launch-video-overlay" role="dialog" aria-label="Ritual intro video">
      <div className="ritual-launch-video-stage" data-playing={hasStarted ? "true" : "false"}>
        {!hasStarted ? (
          <div className="ritual-launch-video-poster">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="ritual-launch-video-poster-image" decoding="async" />
            ) : null}
          </div>
        ) : null}

        <RitualVideoPlayer
          ref={playerRef}
          src={src}
          poster={poster}
          muted={isMuted}
          className="ritual-launch-video"
          onBufferingChange={setIsBuffering}
          onPlaying={() => {
            setHasStarted(true);
            setIsBuffering(false);
            setShowSlowMessage(false);
          }}
          onEnded={() => {
            setShowContinue(true);
            setIsBuffering(false);
          }}
          onError={() => {
            setHasError(true);
            setIsBuffering(false);
          }}
        />
      </div>

      <div className="ritual-launch-video-vignette" aria-hidden="true" />

      {isBuffering && !hasError && !showContinue ? (
        <div className="ritual-launch-video-loader" aria-live="polite">
          <span className="ritual-launch-video-spinner" />
        </div>
      ) : null}

      {showSlowMessage && !hasStarted && !hasError ? (
        <p className="ritual-launch-video-slow-message font-cover-title">
          The archive is taking longer than expected…
        </p>
      ) : null}

      {showSoundButton && isMuted && !showContinue ? (
        <button type="button" onClick={() => void enableSound()} className="ritual-launch-video-sound">
          Tap for sound
        </button>
      ) : null}

      {showContinue ? (
        <div className="ritual-launch-video-continue-wrap">
          <button type="button" onClick={handleContinue} className="gold-button ritual-launch-video-continue">
            Continue
          </button>
        </div>
      ) : null}

      <button type="button" onClick={handleSkip} className="ritual-launch-video-skip-top">
        Skip intro
      </button>
    </div>
  );
}
