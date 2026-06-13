"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RITUAL_LAUNCH_VIDEO_PATH } from "@/lib/video-config";

type RitualLaunchVideoProps = {
  onComplete: () => void;
};

export default function RitualLaunchVideo({ onComplete }: RitualLaunchVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const finish = useCallback(() => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        setHasError(true);
        finish();
      });
    }
  }, [finish, isReady]);

  if (hasError) {
    return null;
  }

  return (
    <motion.div
      className="ritual-launch-video-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      role="dialog"
      aria-label="Vidéo d'ouverture du rituel"
    >
      <video
        ref={videoRef}
        className="ritual-launch-video"
        src={RITUAL_LAUNCH_VIDEO_PATH}
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setIsReady(true)}
        onEnded={finish}
        onError={() => {
          setHasError(true);
          finish();
        }}
      />

      <div className="ritual-launch-video-vignette" aria-hidden="true" />

      <div className="ritual-launch-video-controls">
        <button
          type="button"
          onClick={finish}
          className="ritual-launch-video-skip"
        >
          Passer
        </button>
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) {
              return;
            }
            const nextMuted = !video.muted;
            video.muted = nextMuted;
            setIsMuted(nextMuted);
          }}
          className="ritual-launch-video-mute"
        >
          {isMuted ? "Son" : "Muet"}
        </button>
      </div>
    </motion.div>
  );
}
