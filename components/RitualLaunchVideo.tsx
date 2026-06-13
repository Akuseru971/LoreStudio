"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getRitualLaunchVideoSrc } from "@/lib/video-config";

type RitualLaunchVideoProps = {
  onComplete: () => void;
};

export default function RitualLaunchVideo({ onComplete }: RitualLaunchVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const videoSrc = getRitualLaunchVideoSrc();
  const [needsUserPlay, setNeedsUserPlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const finish = useCallback(() => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || completedRef.current) {
      return;
    }

    video.muted = true;
    setIsMuted(true);

    try {
      await video.play();
      setIsPlaying(true);
      setNeedsUserPlay(false);
      setLoadError(false);
    } catch {
      setNeedsUserPlay(true);
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    void attemptPlay();
  }, [attemptPlay, videoSrc]);

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
        key={videoSrc}
        className="ritual-launch-video"
        src={videoSrc}
        muted
        playsInline
        autoPlay
        preload="auto"
        onCanPlay={() => void attemptPlay()}
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={finish}
        onError={() => {
          setLoadError(true);
          setNeedsUserPlay(true);
        }}
      />

      <div className="ritual-launch-video-vignette" aria-hidden="true" />

      {needsUserPlay && !isPlaying ? (
        <div className="ritual-launch-video-prompt">
          <p className="font-cover-title text-lg text-[#e8dcc8]/90">
            {loadError ? "La vidéo n'a pas pu démarrer automatiquement." : "Votre légende commence…"}
          </p>
          <button type="button" onClick={() => void attemptPlay()} className="gold-button mt-4 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.24em]">
            Lancer la vidéo
          </button>
        </div>
      ) : null}

      <div className="ritual-launch-video-controls">
        <button type="button" onClick={finish} className="ritual-launch-video-skip">
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
