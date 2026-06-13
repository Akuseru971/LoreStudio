"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import RitualVideoPlayer, { type RitualVideoPlayerHandle } from "@/components/RitualVideoPlayer";

export type RitualLaunchVideoProps = {
  src: string;
  poster?: string;
  onEnded: () => void;
  onSkip: () => void;
};

const SLOW_LOAD_MS = 5000;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-launch-video-icon">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-launch-video-icon">
      <path d="M7 5h3v14H7V5zm7 0h3v14h-3V5z" fill="currentColor" />
    </svg>
  );
}

function MuteIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-launch-video-icon">
        <path
          d="M16.5 12a4.5 4.5 0 00-2.5-4.03v7.06A4.48 4.48 0 0016.5 12zM19 12c0 1.48-.37 2.87-1.02 4.08l1.5 1.5A9.96 9.96 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-launch-video-icon">
      <path
        d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 01-2.5 4.03V7.97A4.48 4.48 0 0116.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RitualLaunchVideo({ src, poster, onEnded, onSkip }: RitualLaunchVideoProps) {
  const playerRef = useRef<RitualVideoPlayerHandle | null>(null);
  const finishedRef = useRef(false);
  const playAttemptedRef = useRef(false);

  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSoundButton, setShowSoundButton] = useState(false);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
      setIsPlaying(true);
      setIsBuffering(false);
      setShowSoundButton(false);
      return;
    }

    setIsMuted(true);
    setShowSoundButton(true);

    const mutedPlay = await playerRef.current.play(false);
    if (mutedPlay) {
      setHasStarted(true);
      setIsPlaying(true);
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
      setIsPlaying(true);
      setIsBuffering(false);
      return;
    }

    setIsMuted(true);
    setShowSoundButton(true);
  }, []);

  const handleTogglePlay = useCallback(() => {
    void playerRef.current?.togglePlay();
  }, []);

  const handleToggleMute = useCallback(() => {
    playerRef.current?.toggleMute();
    setIsMuted((current) => !current);
    if (isMuted) {
      setShowSoundButton(false);
    }
  }, [isMuted]);

  const handleSeek = useCallback((value: number) => {
    playerRef.current?.seek(value);
    setCurrentTime(value);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="ritual-launch-video-overlay" role="dialog" aria-label="Intro video">
      <div className="ritual-launch-video-frame">
        <header className="ritual-launch-video-header">
          <div>
            <p className="ritual-launch-video-eyebrow font-title">Archive Prologue</p>
            <h2 className="ritual-launch-video-title font-cover-title">The legend begins</h2>
          </div>
          <button type="button" onClick={handleSkip} className="ritual-launch-video-skip-top">
            Skip intro
          </button>
        </header>

        <div className="ritual-launch-video-screen" data-playing={hasStarted ? "true" : "false"}>
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
              setIsPlaying(true);
              setIsBuffering(false);
              setShowSlowMessage(false);
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onEnded={() => {
              setShowContinue(true);
              setIsPlaying(false);
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
        </div>

        <div className="ritual-launch-video-controls" aria-label="Video controls">
          <button
            type="button"
            className="ritual-launch-video-control-btn"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <span className="ritual-launch-video-time">{formatTime(currentTime)}</span>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="ritual-launch-video-progress"
            aria-label="Video progress"
            style={{ "--progress": `${progress}%` } as CSSProperties}
          />

          <span className="ritual-launch-video-time">{formatTime(duration)}</span>

          <button
            type="button"
            className="ritual-launch-video-control-btn"
            onClick={handleToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <MuteIcon muted={isMuted} />
          </button>
        </div>

        {showSlowMessage && !hasStarted && !hasError ? (
          <p className="ritual-launch-video-slow-message font-cover-title">
            The archive is taking longer than expected…
          </p>
        ) : null}
      </div>
    </div>
  );
}
