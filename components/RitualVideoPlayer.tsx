"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { isDirectRitualVideoUrl } from "@/lib/video-config";

export type RitualVideoPlayerHandle = {
  play: (preferSound?: boolean) => Promise<boolean>;
  enableSound: () => Promise<boolean>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  toggleMute: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
  unmuteWithVolume: (volume: number) => Promise<boolean>;
};

export type RitualVideoPlayerProps = {
  src: string;
  poster?: string;
  muted: boolean;
  volume?: number;
  nativeControls?: boolean;
  onReady?: () => void;
  onBufferingChange?: (buffering: boolean) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  onMutedChange?: (muted: boolean) => void;
  onEnded?: () => void;
  onError?: () => void;
  onStalled?: () => void;
  onLoadedData?: () => void;
  className?: string;
};

const RitualVideoPlayer = forwardRef<RitualVideoPlayerHandle, RitualVideoPlayerProps>(
  function RitualVideoPlayer(
    {
      src,
      poster,
      muted,
      volume = 1,
      nativeControls = false,
      onReady,
      onBufferingChange,
      onPlaying,
      onPause,
      onTimeUpdate,
      onDurationChange,
      onVolumeChange,
      onMutedChange,
      onEnded,
      onError,
      onStalled,
      onLoadedData,
      className,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const bufferingTimerRef = useRef<number | undefined>(undefined);
    const readyRef = useRef(false);

    const setBuffering = (buffering: boolean) => {
      if (buffering) {
        if (bufferingTimerRef.current) {
          return;
        }
        bufferingTimerRef.current = window.setTimeout(() => {
          onBufferingChange?.(true);
        }, 280);
        return;
      }

      if (bufferingTimerRef.current) {
        window.clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = undefined;
      }
      onBufferingChange?.(false);
    };

    const playVideo = async (preferSound = false) => {
      const video = videoRef.current;
      if (!video) {
        return false;
      }

      video.volume = volume;

      if (preferSound) {
        video.muted = false;
        try {
          await video.play();
          onMutedChange?.(false);
          return true;
        } catch {
          video.muted = true;
          try {
            await video.play();
            onMutedChange?.(true);
            return false;
          } catch {
            return false;
          }
        }
      }

      video.muted = true;
      try {
        await video.play();
        onMutedChange?.(true);
        return true;
      } catch {
        return false;
      }
    };

    useImperativeHandle(ref, () => ({
      play: playVideo,
      enableSound: async () => {
        const video = videoRef.current;
        if (!video) {
          return false;
        }
        video.muted = false;
        video.volume = volume;
        try {
          await video.play();
          onMutedChange?.(false);
          onVolumeChange?.(video.volume);
          return true;
        } catch {
          video.muted = true;
          onMutedChange?.(true);
          return false;
        }
      },
      unmuteWithVolume: async (targetVolume: number) => {
        const video = videoRef.current;
        if (!video) {
          return false;
        }
        video.muted = false;
        video.volume = Math.min(1, Math.max(0, targetVolume));
        onVolumeChange?.(video.volume);
        onMutedChange?.(false);
        try {
          await video.play();
          return true;
        } catch {
          video.muted = true;
          onMutedChange?.(true);
          return false;
        }
      },
      pause: () => {
        videoRef.current?.pause();
      },
      togglePlay: async () => {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        if (video.paused) {
          await video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      toggleMute: () => {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.muted = !video.muted;
        onMutedChange?.(video.muted);
      },
      seek: (time: number) => {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.currentTime = time;
      },
      setVolume: (nextVolume: number) => {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.volume = Math.min(1, Math.max(0, nextVolume));
        onVolumeChange?.(video.volume);
      },
      getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      readyRef.current = false;

      if (!isDirectRitualVideoUrl(src)) {
        onError?.();
        return;
      }

      video.src = src;
      video.load();
    }, [onError, src]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.volume = volume;
    }, [volume]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.muted = muted;
    }, [muted]);

    useEffect(() => {
      return () => {
        if (bufferingTimerRef.current) {
          window.clearTimeout(bufferingTimerRef.current);
        }
      };
    }, []);

    return (
      <video
        ref={videoRef}
        className={className}
        poster={poster}
        playsInline
        preload="auto"
        controls={nativeControls}
        muted={muted}
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!readyRef.current) {
            readyRef.current = true;
            onReady?.();
          }
          if (video && Number.isFinite(video.duration)) {
            onDurationChange?.(video.duration);
          }
        }}
        onDurationChange={() => {
          const video = videoRef.current;
          if (video && Number.isFinite(video.duration)) {
            onDurationChange?.(video.duration);
          }
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (video) {
            onTimeUpdate?.(video.currentTime);
          }
        }}
        onVolumeChange={() => {
          const video = videoRef.current;
          if (!video) {
            return;
          }
          onVolumeChange?.(video.volume);
          onMutedChange?.(video.muted);
        }}
        onCanPlayThrough={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onStalled={() => {
          setBuffering(true);
          onStalled?.();
        }}
        onLoadedData={() => {
          onLoadedData?.();
        }}
        onPlaying={() => {
          setBuffering(false);
          onPlaying?.();
        }}
        onPause={() => onPause?.()}
        onEnded={() => {
          setBuffering(false);
          onEnded?.();
        }}
        onError={() => {
          setBuffering(false);
          onError?.();
        }}
      />
    );
  },
);

export default RitualVideoPlayer;
