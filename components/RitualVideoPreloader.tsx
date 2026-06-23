"use client";

import { useEffect, useRef } from "react";
import { getRitualVideoUrl } from "@/lib/video-config";

export default function RitualVideoPreloader() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = getRitualVideoUrl();

  useEffect(() => {
    if (!src || src.startsWith("/api/")) {
      return;
    }

    console.log("[RITUAL_VIDEO_URL]", src);
    console.log("[RITUAL_VIDEO_PRELOAD_RENDERED]");

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

  if (!src || src.startsWith("/api/")) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      preload="auto"
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
