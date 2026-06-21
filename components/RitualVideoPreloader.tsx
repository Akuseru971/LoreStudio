"use client";

import { useEffect, useRef } from "react";
import { getRitualLaunchVideoSrc, isRitualLaunchVideoConfigured } from "@/lib/video-config";

export default function RitualVideoPreloader() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = getRitualLaunchVideoSrc();

  useEffect(() => {
    if (!src || !isRitualLaunchVideoConfigured()) {
      return;
    }

    console.log("[VIDEO_PRELOAD_STARTED]", Date.now());

    const existing = document.querySelector<HTMLLinkElement>(`link[data-ritual-video-preload="${src}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = src;
      link.setAttribute("data-ritual-video-preload", src);
      document.head.appendChild(link);
    }

    const video = videoRef.current;
    if (video) {
      video.src = src;
      video.load();
    }

    return () => {
      document.querySelector<HTMLLinkElement>(`link[data-ritual-video-preload="${src}"]`)?.remove();
    };
  }, [src]);

  if (!src || !isRitualLaunchVideoConfigured()) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      className="ritual-video-preloader"
      preload="auto"
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
