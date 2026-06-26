export function logRitualVideoState(video: HTMLVideoElement, label: string) {
  console.log(label, {
    src: video.currentSrc || video.src,
    readyState: video.readyState,
    networkState: video.networkState,
    paused: video.paused,
    muted: video.muted,
    currentTime: video.currentTime,
    duration: video.duration,
    error: video.error,
  });
}

export function logRitualVideoError(event: React.SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget;
  console.error("[RITUAL_VIDEO_ERROR]", {
    error: video.error,
    src: video.currentSrc || video.src,
    readyState: video.readyState,
    networkState: video.networkState,
  });
}

export function attachRitualVideoLogging(
  video: HTMLVideoElement,
  prefix: "RITUAL_PRELOAD" | "RITUAL_VIDEO",
) {
  const log = (event: string, extra?: Record<string, unknown>) => {
    console.log(`[${prefix}_${event}]`, extra ?? "");
  };

  const handlers: Array<{ event: string; handler: () => void }> = [
    { event: "loadstart", handler: () => log("LOAD_START") },
    {
      event: "loadedmetadata",
      handler: () =>
        log("METADATA", {
          duration: video.duration,
        }),
    },
    { event: "loadeddata", handler: () => log("LOADED_DATA") },
    { event: "canplay", handler: () => log("CAN_PLAY") },
    { event: "canplaythrough", handler: () => log("CAN_PLAY_THROUGH") },
    { event: "play", handler: () => log("PLAY") },
    { event: "playing", handler: () => log("PLAYING", { currentTime: video.currentTime }) },
    {
      event: "pause",
      handler: () =>
        log("PAUSE", {
          currentTime: video.currentTime,
        }),
    },
    { event: "waiting", handler: () => log("WAITING") },
    { event: "stalled", handler: () => log("STALLED") },
    { event: "suspend", handler: () => log("SUSPEND") },
    { event: "ended", handler: () => log("ENDED") },
    {
      event: "error",
      handler: () =>
        console.error(`[${prefix}_ERROR]`, {
          error: video.error,
          src: video.currentSrc || video.src,
          readyState: video.readyState,
          networkState: video.networkState,
        }),
    },
  ];

  handlers.forEach(({ event, handler }) => {
    video.addEventListener(event, handler);
  });

  return () => {
    handlers.forEach(({ event, handler }) => {
      video.removeEventListener(event, handler);
    });
  };
}
