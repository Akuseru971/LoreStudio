"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type RitualVideoPlayerHandle = {
  play: (preferSound?: boolean) => Promise<boolean>;
  enableSound: () => Promise<boolean>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  toggleMute: () => void;
  seek: (time: number) => void;
};

export type RitualVideoPlayerProps = {
  src: string;
  poster?: string;
  muted: boolean;
  onReady?: () => void;
  onBufferingChange?: (buffering: boolean) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  onError?: () => void;
  className?: string;
};

const RitualVideoPlayer = forwardRef<RitualVideoPlayerHandle, RitualVideoPlayerProps>(
  function RitualVideoPlayer(
    {
      src,
      poster,
      muted,
      onReady,
      onBufferingChange,
      onPlaying,
      onPause,
      onTimeUpdate,
      onDurationChange,
      onEnded,
      onError,
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

      if (preferSound) {
        video.muted = false;
        try {
          await video.play();
          return true;
        } catch {
          video.muted = true;
        }
      } else {
        video.muted = true;
      }

      try {
        await video.play();
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
        try {
          await video.play();
          return true;
        } catch {
          video.muted = true;
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
      },
      seek: (time: number) => {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.currentTime = time;
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      readyRef.current = false;
      video.src = src;
      video.load();
    }, [src]);

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
        controls={false}
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
        onCanPlayThrough={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
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
