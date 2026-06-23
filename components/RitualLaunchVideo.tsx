"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { attachRitualVideoLogging, logRitualVideoState } from "@/lib/ritual-video-events";
import { isDirectRitualVideoUrl } from "@/lib/video-config";
import { cn } from "@/lib/utils";

export type RitualLaunchVideoProps = {
  src: string;
  poster?: string;
  mode: "preload" | "playback";
  onEnded: () => void;
  onSkip: () => void;
};

const SLOW_LOAD_MS = 5000;
const CANPLAY_TIMEOUT_MS = 8000;
const PLAYBACK_FALLBACK_MS = 5000;
const CONTROLS_HIDE_MS = 2500;
const DEFAULT_VOLUME = 0.7;
const UNMUTE_DELAY_MS = 300;

const HIDDEN_VIDEO_STYLE: CSSProperties = {
  position: "fixed",
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none",
  left: "-10px",
  top: "-10px",
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function useDebugVideoEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEnabled(process.env.NODE_ENV === "development" || params.get("debugVideo") === "1");
  }, []);

  return enabled;
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
  mode,
  onEnded,
  onSkip,
}: RitualLaunchVideoProps) {
  const ritualVideoUrl = useMemo(() => (isDirectRitualVideoUrl(src) ? src : null), [src]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const finishedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const metadataLoadedRef = useRef(false);
  const canPlayRef = useRef(false);
  const hideControlsTimerRef = useRef<number | undefined>(undefined);
  const debugEnabled = useDebugVideoEnabled();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(mode === "playback");
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showTapForSound, setShowTapForSound] = useState(false);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showPosterFallback, setShowPosterFallback] = useState(false);
  const [debugTick, setDebugTick] = useState(0);

  const isPlayback = mode === "playback";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const finish = useCallback((handler: () => void) => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    videoRef.current?.pause();
    handler();
  }, []);

  const handleSkip = useCallback(() => finish(onSkip), [finish, onSkip]);

  const revealControls = useCallback(
    (autoHide = true) => {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
      if (autoHide && isPlaying && !showTapForSound) {
        hideControlsTimerRef.current = window.setTimeout(() => {
          setControlsVisible(false);
        }, CONTROLS_HIDE_MS);
      }
    },
    [isPlaying, showTapForSound],
  );

  const startRitualVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || finishedRef.current || !ritualVideoUrl) {
      console.warn("[RITUAL_VIDEO_NO_REF]");
      return;
    }

    logRitualVideoState(video, "[RITUAL_VIDEO_PLAY_ATTEMPT]");

    try {
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.volume = DEFAULT_VOLUME;

      await video.play();

      logRitualVideoState(video, "[RITUAL_VIDEO_PLAYING_MUTED]");

      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(false);
      setIsMuted(true);
      setShowPosterFallback(false);
      setShowSlowMessage(false);

      window.setTimeout(() => {
        try {
          if (!videoRef.current || videoRef.current.paused) {
            return;
          }
          videoRef.current.muted = false;
          videoRef.current.volume = DEFAULT_VOLUME;
          setIsMuted(false);
          setShowTapForSound(false);
          console.log("[RITUAL_VIDEO_UNMUTED]");
        } catch (error) {
          console.warn("[RITUAL_VIDEO_UNMUTE_FAILED]", error);
          setShowTapForSound(true);
        }
      }, UNMUTE_DELAY_MS);
    } catch (error) {
      console.error("[RITUAL_VIDEO_PLAY_FAILED]", error);
      setHasError(true);
      setShowPosterFallback(true);
      setIsBuffering(false);
    }
  }, [ritualVideoUrl]);

  const handleTapForSound = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      video.muted = false;
      video.volume = DEFAULT_VOLUME;
      await video.play();
      setIsMuted(false);
      setShowTapForSound(false);
      console.log("[RITUAL_VIDEO_UNMUTED]");
    } catch (error) {
      console.warn("[RITUAL_VIDEO_UNMUTE_FAILED]", error);
    }
  }, []);

  useEffect(() => {
    if (!ritualVideoUrl) {
      console.error("[INVALID_RITUAL_VIDEO_SOURCE]", src);
      setHasError(true);
      setShowPosterFallback(true);
    }
  }, [ritualVideoUrl, src]);

  useEffect(() => {
    if (!ritualVideoUrl) {
      return;
    }

    console.log("[RITUAL_VIDEO_PRELOAD_RENDERED]");

    const existing = document.querySelector<HTMLLinkElement>(`link[data-ritual-video-preload="${ritualVideoUrl}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = ritualVideoUrl;
      link.type = "video/mp4";
      link.setAttribute("data-ritual-video-preload", ritualVideoUrl);
      document.head.appendChild(link);
    }
  }, [ritualVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ritualVideoUrl) {
      return;
    }

    if (!video.src && !video.currentSrc) {
      video.src = ritualVideoUrl;
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.load();
    }

    const prefix = isPlayback ? "RITUAL_VIDEO" : "RITUAL_PRELOAD";
    return attachRitualVideoLogging(video, prefix);
  }, [isPlayback, ritualVideoUrl]);

  useEffect(() => {
    if (!isPlayback || playbackStartedRef.current || !ritualVideoUrl) {
      return;
    }

    playbackStartedRef.current = true;
    requestAnimationFrame(() => {
      void startRitualVideo();
    });
  }, [isPlayback, ritualVideoUrl, startRitualVideo]);

  useEffect(() => {
    if (!ritualVideoUrl) {
      return;
    }

    const metadataTimer = window.setTimeout(() => {
      if (!metadataLoadedRef.current && !hasError) {
        console.warn("[RITUAL_VIDEO_FILE_MAY_BE_INVALID_OR_NOT_STREAMABLE]");
        setShowSlowMessage(true);
        if (isPlayback) {
          setShowPosterFallback(true);
        }
      }
    }, SLOW_LOAD_MS);

    const canPlayTimer = window.setTimeout(() => {
      if (!canPlayRef.current && !hasError) {
        console.warn("[RITUAL_VIDEO_FILE_MAY_BE_INVALID_OR_NOT_STREAMABLE]");
        if (isPlayback) {
          setShowPosterFallback(true);
        }
      }
    }, CANPLAY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(metadataTimer);
      window.clearTimeout(canPlayTimer);
    };
  }, [hasError, isPlayback, ritualVideoUrl]);

  useEffect(() => {
    if (!isPlayback || hasStarted || hasError) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!hasStarted && !hasError) {
        setShowPosterFallback(true);
        setShowSlowMessage(true);
      }
    }, PLAYBACK_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [hasError, hasStarted, isPlayback]);

  useEffect(() => {
    if (!hasError || !isPlayback) {
      return;
    }

    const timer = window.setTimeout(() => handleSkip(), 3200);
    return () => window.clearTimeout(timer);
  }, [handleSkip, hasError, isPlayback]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const frame = frameRef.current;
      setIsFullscreen(Boolean(frame && document.fullscreenElement === frame));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!debugEnabled) {
      return;
    }

    const interval = window.setInterval(() => setDebugTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [debugEnabled]);

  if (!ritualVideoUrl) {
    return null;
  }

  const videoElement = (
    <video
      ref={videoRef}
      className={isPlayback ? "ritual-launch-video" : undefined}
      src={ritualVideoUrl}
      poster={poster}
      playsInline
      preload="auto"
      muted={isMuted}
      disablePictureInPicture
      disableRemotePlayback
      style={isPlayback ? undefined : HIDDEN_VIDEO_STYLE}
      onLoadedMetadata={(event) => {
        metadataLoadedRef.current = true;
        const video = event.currentTarget;
        if (Number.isFinite(video.duration)) {
          setDuration(video.duration);
        }
      }}
      onLoadedData={() => {
        if (isPlayback) {
          setShowSlowMessage(false);
        }
      }}
      onCanPlay={() => {
        canPlayRef.current = true;
        setIsBuffering(false);
      }}
      onCanPlayThrough={() => setIsBuffering(false)}
      onWaiting={() => setIsBuffering(true)}
      onStalled={() => setIsBuffering(true)}
      onSuspend={() => setIsBuffering(false)}
      onPlay={() => setIsPlaying(true)}
      onPlaying={() => {
        setHasStarted(true);
        setIsPlaying(true);
        setIsBuffering(false);
        setShowPosterFallback(false);
        setShowSlowMessage(false);
      }}
      onPause={() => setIsPlaying(false)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onEnded={() => {
        setIsPlaying(false);
        finish(onEnded);
      }}
      onError={() => {
        setHasError(true);
        setIsBuffering(false);
        setIsPlaying(false);
        setShowPosterFallback(true);
      }}
    />
  );

  if (!isPlayback) {
    return videoElement;
  }

  const debugVideo = videoRef.current;

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

          {showPosterFallback || !hasStarted ? (
            <div className="ritual-launch-video-poster">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="ritual-launch-video-poster-image" decoding="async" />
              ) : null}
            </div>
          ) : null}

          {videoElement}

          {isBuffering && !hasError ? (
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

          {showSlowMessage && !hasError ? (
            <p className="ritual-launch-video-slow-message font-cover-title">
              The archive is taking longer than expected…
            </p>
          ) : null}

          {showTapForSound && isMuted && !hasError ? (
            <div className="ritual-launch-video-sound-wrap">
              <button type="button" onClick={() => void handleTapForSound()} className="ritual-launch-video-sound">
                Tap for sound
              </button>
              <p className="ritual-launch-video-sound-sub">Your legend has a voice.</p>
            </div>
          ) : null}

          <button type="button" onClick={handleSkip} className="ritual-launch-video-skip-top">
            Skip intro
          </button>

          <div
            className={cn("ritual-launch-video-controls", controlsVisible && "is-visible")}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ritual-player-btn"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) {
                  void video.play();
                } else {
                  video.pause();
                }
              }}
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
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = Number(event.target.value);
                setCurrentTime(video.currentTime);
              }}
              className="ritual-player-progress"
              aria-label="Video progress"
              style={{ "--progress": `${progress}%` } as CSSProperties}
            />

            <span className="ritual-player-time">{formatTime(duration)}</span>

            <button
              type="button"
              className="ritual-player-btn"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = !video.muted;
                setIsMuted(video.muted);
              }}
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
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                const nextVolume = Number(event.target.value);
                video.volume = nextVolume;
                video.muted = nextVolume === 0;
                setVolume(nextVolume);
                setIsMuted(video.muted);
              }}
              className="ritual-player-volume"
              aria-label="Volume"
              style={{ "--progress": `${(isMuted ? 0 : volume) * 100}%` } as CSSProperties}
            />

            <button
              type="button"
              className="ritual-player-btn"
              onClick={() => {
                const frame = frameRef.current;
                if (!frame) return;
                if (document.fullscreenElement) {
                  void document.exitFullscreen();
                } else {
                  void frame.requestFullscreen();
                }
              }}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <FullscreenIcon active={isFullscreen} />
            </button>
          </div>
        </div>
      </div>

      {debugEnabled ? (
        <div className="fixed bottom-4 left-4 z-[200] max-w-sm rounded-xl border border-white/20 bg-black/85 p-3 text-left text-[11px] text-[#e8dcc0]">
          <p className="font-semibold uppercase tracking-[0.14em] text-[#d9bd78]">Ritual video debug</p>
          <p className="mt-2 break-all">src: {debugVideo?.currentSrc || debugVideo?.src || ritualVideoUrl}</p>
          <p>readyState: {debugVideo?.readyState ?? "-"}</p>
          <p>networkState: {debugVideo?.networkState ?? "-"}</p>
          <p>paused: {String(debugVideo?.paused ?? true)}</p>
          <p>currentTime: {debugVideo?.currentTime ?? 0}</p>
          <p>duration: {debugVideo?.duration ?? 0}</p>
          <p>muted: {String(debugVideo?.muted ?? true)}</p>
          <p>error: {debugVideo?.error?.code ?? "none"}</p>
          <p className="text-[#9baabd]">tick: {debugTick}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-white/20 px-2 py-1"
              onClick={() => videoRef.current?.load()}
            >
              Load
            </button>
            <button
              type="button"
              className="rounded border border-white/20 px-2 py-1"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = true;
                void video.play();
              }}
            >
              Play muted
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
