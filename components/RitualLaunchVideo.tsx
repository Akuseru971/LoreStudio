"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import RitualVideoPlayer, { type RitualVideoPlayerHandle } from "@/components/RitualVideoPlayer";
import { isDirectRitualVideoUrl } from "@/lib/video-config";
import { cn } from "@/lib/utils";

export type RitualLaunchVideoProps = {
  src: string;
  poster?: string;
  onEnded: () => void;
  onSkip: () => void;
  useNativeControlsOnMobile?: boolean;
};

const SLOW_LOAD_MS = 5000;
const CONTROLS_HIDE_MS = 2500;
const DEFAULT_VOLUME = 0.9;

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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
      <path d="M7 5h3v14H7V5zm7 0h3v14h-3V5z" fill="currentColor" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
        <path
          d="M16.5 12a4.5 4.5 0 00-2.5-4.03v7.06A4.48 4.48 0 0016.5 12zM19 12c0 1.48-.37 2.87-1.02 4.08l1.5 1.5A9.96 9.96 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
      <path
        d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 01-2.5 4.03V7.97A4.48 4.48 0 0116.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"
        fill="currentColor"
      />
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
        <path
          d="M9 9V5H5v4H3V3h6v6H9zm10 0h-2V5h-4V3h6v6zm-6 12H9v-4H5v-4H3v6h6v-2zm10-2h-2v4h-4v2h6v-6z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ritual-player-icon">
      <path
        d="M7 7H3v4H1V1h10v2H7v4zm10 0V3h-4V1h6v6h-2V7zM7 17v4h4v2H1v-10h2v8h4zm10 0h4v-4h2v10h-10v-2h4v-4z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RitualLaunchVideo({
  src,
  poster,
  onEnded,
  onSkip,
  useNativeControlsOnMobile = false,
}: RitualLaunchVideoProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<RitualVideoPlayerHandle | null>(null);
  const finishedRef = useRef(false);
  const playAttemptedRef = useRef(false);
  const hideControlsTimerRef = useRef<number | undefined>(undefined);

  const [isMobile, setIsMobile] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showPlayPrompt, setShowPlayPrompt] = useState(false);
  const [showTapForSound, setShowTapForSound] = useState(false);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const useNativeControls = isMobile && useNativeControlsOnMobile;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const safeSrc = isDirectRitualVideoUrl(src) ? src : null;

  useEffect(() => {
    if (!safeSrc) {
      console.error("[RITUAL_VIDEO_INVALID_SOURCE]", src);
      setHasError(true);
      setIsBuffering(false);
    }
  }, [safeSrc, src]);

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

  const revealControls = useCallback(
    (autoHide = true) => {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
      if (autoHide && isPlaying && !showPlayPrompt && !showTapForSound) {
        hideControlsTimerRef.current = window.setTimeout(() => {
          setControlsVisible(false);
        }, CONTROLS_HIDE_MS);
      }
    },
    [isPlaying, showPlayPrompt, showTapForSound],
  );

  const attemptPlay = useCallback(async () => {
    if (finishedRef.current || showContinue || !playerRef.current) {
      return;
    }

    playerRef.current.setVolume(DEFAULT_VOLUME);
    setVolume(DEFAULT_VOLUME);

    const withSound = await playerRef.current.play(true);
    if (withSound) {
      setIsMuted(false);
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
      setShowPlayPrompt(false);
      setShowTapForSound(false);
      return;
    }

    const video = playerRef.current.getVideoElement();
    if (video && !video.paused) {
      setIsMuted(true);
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
      setShowTapForSound(true);
      setShowPlayPrompt(false);
      return;
    }

    const mutedPlay = await playerRef.current.play(false);
    if (mutedPlay) {
      setIsMuted(true);
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
      setShowTapForSound(true);
      setShowPlayPrompt(false);
      return;
    }

    setShowPlayPrompt(true);
    setShowTapForSound(false);
  }, [showContinue]);

  const handlePlayIntro = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    setShowPlayPrompt(false);
    setShowTapForSound(false);
    setVolume(DEFAULT_VOLUME);
    playerRef.current.setVolume(DEFAULT_VOLUME);

    const ok = await playerRef.current.unmuteWithVolume(DEFAULT_VOLUME);
    if (ok) {
      setIsMuted(false);
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
      return;
    }

    const mutedOk = await playerRef.current.play(false);
    if (mutedOk) {
      setIsMuted(true);
      setHasStarted(true);
      setIsPlaying(true);
      setShowTapForSound(true);
    }
  }, []);

  const handleTapForSound = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    setVolume(DEFAULT_VOLUME);
    playerRef.current.setVolume(DEFAULT_VOLUME);
    const ok = await playerRef.current.unmuteWithVolume(DEFAULT_VOLUME);
    if (ok) {
      setIsMuted(false);
      setShowTapForSound(false);
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
    }
  }, []);

  const handleTogglePlay = useCallback(async () => {
    revealControls(false);
    await playerRef.current?.togglePlay();
  }, [revealControls]);

  const handleToggleMute = useCallback(() => {
    revealControls(false);
    playerRef.current?.toggleMute();
  }, [revealControls]);

  const handleVolumeChange = useCallback(
    (value: number) => {
      setVolume(value);
      playerRef.current?.setVolume(value);
      if (value > 0 && isMuted) {
        setIsMuted(false);
        const video = playerRef.current?.getVideoElement();
        if (video) {
          video.muted = false;
        }
      }
    },
    [isMuted],
  );

  const handleSeek = useCallback(
    (value: number) => {
      playerRef.current?.seek(value);
      setCurrentTime(value);
      revealControls(false);
    },
    [revealControls],
  );

  const toggleFullscreen = useCallback(async () => {
    const frame = frameRef.current;
    const video = playerRef.current?.getVideoElement();

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (frame?.requestFullscreen) {
        await frame.requestFullscreen();
        return;
      }

      const webkitVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (webkitVideo?.webkitEnterFullscreen) {
        webkitVideo.webkitEnterFullscreen();
      }
    } catch {
      // Fullscreen may be blocked; keep inline playback.
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
    const timer = window.setTimeout(() => handleSkip(), 2200);
    return () => window.clearTimeout(timer);
  }, [handleSkip, hasError]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const frame = frameRef.current;
      setIsFullscreen(Boolean(frame && document.fullscreenElement === frame));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      revealControls();
    } else {
      setControlsVisible(true);
    }
  }, [isPlaying, revealControls]);

  return (
    <div
      className={cn("ritual-launch-video-overlay", isFullscreen && "ritual-launch-video-overlay-fs")}
      role="dialog"
      aria-label="Ritual intro video"
      onMouseMove={() => revealControls()}
    >
      <div className="ritual-launch-video-backdrop" aria-hidden="true">
        <div className="ritual-launch-video-backdrop-glow" />
        <div className="ritual-launch-video-backdrop-smoke" />
      </div>

      <div className="ritual-launch-video-stage">
        <div
          ref={frameRef}
          className={cn("ritual-launch-video-frame", isFullscreen && "ritual-launch-video-frame-fs")}
          onClick={() => revealControls()}
        >
          <div className="ritual-launch-video-vignette" aria-hidden="true" />

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
            src={safeSrc || ""}
            poster={poster}
            muted={isMuted}
            volume={volume}
            nativeControls={useNativeControls}
            className="ritual-launch-video"
            onBufferingChange={setIsBuffering}
            onPlaying={() => {
              setHasStarted(true);
              setIsPlaying(true);
              setIsBuffering(false);
              setShowSlowMessage(false);
              setShowPlayPrompt(false);
              const video = playerRef.current?.getVideoElement();
              if (video?.muted) {
                setIsMuted(true);
                setShowTapForSound(true);
              }
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onVolumeChange={setVolume}
            onMutedChange={setIsMuted}
            onEnded={() => {
              setIsPlaying(false);
              setIsBuffering(false);
              setControlsVisible(true);
              finish(onEnded);
            }}
            onError={() => {
              setHasError(true);
              setIsBuffering(false);
              setIsPlaying(false);
            }}
            onStalled={() => setIsBuffering(true)}
            onLoadedData={() => setShowSlowMessage(false)}
          />

          {isBuffering && !hasError && !showContinue ? (
            <div className="ritual-launch-video-loader" aria-live="polite">
              <span className="ritual-launch-video-spinner" />
              <p className="ritual-launch-video-buffer-text">Loading the archive…</p>
            </div>
          ) : null}

          {hasError ? (
            <p className="ritual-launch-video-error-message font-cover-title">
              The archive could not open this vision.
            </p>
          ) : null}

          {showSlowMessage && !hasStarted && !hasError ? (
            <p className="ritual-launch-video-slow-message font-cover-title">
              The archive is taking longer than expected…
            </p>
          ) : null}

          {showPlayPrompt && !showContinue && !hasError ? (
            <div className="ritual-launch-video-prompt-wrap">
              <button
                type="button"
                onClick={() => void handlePlayIntro()}
                className="gold-button ritual-launch-video-prompt"
              >
                Play intro
              </button>
            </div>
          ) : null}

          {showTapForSound && isMuted && !showPlayPrompt && !showContinue && !hasError ? (
            <div className="ritual-launch-video-sound-wrap">
              <button type="button" onClick={() => void handleTapForSound()} className="ritual-launch-video-sound">
                Tap for sound
              </button>
              <p className="ritual-launch-video-sound-sub">Your legend has a voice.</p>
            </div>
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

          {!useNativeControls && !showContinue ? (
            <div
              className={cn("ritual-launch-video-controls", controlsVisible && "is-visible")}
              onClick={(event) => event.stopPropagation()}
              onMouseMove={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="ritual-player-btn"
                onClick={() => void handleTogglePlay()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <span className="ritual-player-time">{formatTime(currentTime)}</span>

              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className="ritual-player-progress"
                aria-label="Video progress"
                style={{ "--progress": `${progress}%` } as CSSProperties}
              />

              <span className="ritual-player-time">{formatTime(duration)}</span>

              <button
                type="button"
                className="ritual-player-btn"
                onClick={handleToggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon muted={isMuted} />
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                className="ritual-player-volume"
                aria-label="Volume"
                style={{ "--progress": `${(isMuted ? 0 : volume) * 100}%` } as CSSProperties}
              />

              <button
                type="button"
                className="ritual-player-btn"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <FullscreenIcon active={isFullscreen} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
