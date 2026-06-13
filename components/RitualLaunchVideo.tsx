"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type RitualLaunchVideoProps = {
  src: string;
  poster?: string;
  onEnded: () => void;
  onSkip: () => void;
};

const SLOW_LOAD_MS = 5000;

export default function RitualLaunchVideo({ src, poster, onEnded, onSkip }: RitualLaunchVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);
  const playAttemptedRef = useRef(false);

  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showSoundButton, setShowSoundButton] = useState(false);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const finish = useCallback(
    (handler: () => void) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      videoRef.current?.pause();
      handler();
    },
    [],
  );

  const handleSkip = useCallback(() => finish(onSkip), [finish, onSkip]);
  const handleContinue = useCallback(() => finish(onEnded), [finish, onEnded]);

  const attemptPlay = useCallback(async (preferSound = false) => {
    const video = videoRef.current;
    if (!video || finishedRef.current || showContinue) {
      return;
    }

    if (preferSound) {
      video.muted = false;
      try {
        await video.play();
        setIsMuted(false);
        setHasStarted(true);
        setIsBuffering(false);
        setShowSoundButton(false);
        return;
      } catch {
        video.muted = true;
        setIsMuted(true);
        setShowSoundButton(true);
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }

    try {
      await video.play();
      setHasStarted(true);
      setIsBuffering(false);
    } catch {
      setShowSoundButton(true);
    }
  }, [showContinue]);

  useLayoutEffect(() => {
    if (playAttemptedRef.current) {
      return;
    }
    playAttemptedRef.current = true;
    void attemptPlay(true);
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
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = false;
    setIsMuted(false);
    setShowSoundButton(false);
    try {
      await video.play();
      setHasStarted(true);
      setIsBuffering(false);
    } catch {
      video.muted = true;
      setIsMuted(true);
      setShowSoundButton(true);
    }
  }, []);

  return (
    <div className="ritual-launch-video-overlay" role="dialog" aria-label="Intro video">
      <div className="ritual-launch-video-poster" aria-hidden="true">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="ritual-launch-video-poster-image" />
        ) : null}
      </div>

      <video
        ref={videoRef}
        className="ritual-launch-video"
        src={src}
        poster={poster}
        playsInline
        preload="auto"
        controls={false}
        muted={isMuted}
        onLoadedMetadata={() => setIsBuffering(true)}
        onCanPlay={() => void attemptPlay(false)}
        onCanPlayThrough={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setHasStarted(true);
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
