// MVP LOCKED DESIGN:
// Do not modify this preview/loading design unless explicitly requested.
// Only change this component for direct UI requests targeting it.

"use client";

import { useEffect, useMemo, useState } from "react";
import { GENERATION_PROGRESS_MESSAGES } from "@/lib/generation-progress";
import type { ApprovedSynopsis, BookFormInput } from "@/lib/types";

type SynopsisLoadingScreenProps = {
  synopsis: ApprovedSynopsis | null;
  formInput?: BookFormInput | null;
  loadingMessage?: string;
};

const INITIAL_PROGRESS = 6;
const EARLY_STAGE_CEILING = 58;
const FIRST_VISION_CEILING = 88;
const COMPLETE_CEILING = 100;
const PROGRESS_TICK_MS = 120;

function getStageCeiling(loadingMessage: string | undefined) {
  const message = loadingMessage?.trim() || GENERATION_PROGRESS_MESSAGES.writing;

  if (message === GENERATION_PROGRESS_MESSAGES.almostReady) {
    return COMPLETE_CEILING;
  }

  if (message === GENERATION_PROGRESS_MESSAGES.firstVisionReady) {
    return FIRST_VISION_CEILING;
  }

  return EARLY_STAGE_CEILING;
}

function getProgressIncrement(current: number, ceiling: number) {
  const gap = ceiling - current;

  if (gap <= 0) {
    return 0;
  }

  if (ceiling >= COMPLETE_CEILING) {
    return Math.max(0.55, gap * 0.14);
  }

  return Math.max(0.1, Math.min(1.05, gap * 0.034));
}

function getScrollDuration(synopsisText: string) {
  const synopsisLength = synopsisText.length || 0;
  const baseScrollDuration = Math.min(28, Math.max(16, synopsisLength / 35));
  return baseScrollDuration * 2;
}

export default function SynopsisLoadingScreen({ synopsis, formInput, loadingMessage }: SynopsisLoadingScreenProps) {
  const [progress, setProgress] = useState(INITIAL_PROGRESS);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProgress((current) => {
        const ceiling = getStageCeiling(loadingMessage);
        if (current >= ceiling) {
          return current;
        }

        const next = current + getProgressIncrement(current, ceiling);
        return Math.min(ceiling, next);
      });
    }, PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadingMessage]);

  const progressPercent = Math.round(progress);

  const characterName = formInput?.name?.trim() || "Your legend";
  const legendaryTitle = synopsis?.legendaryTitle?.trim() || "The chronicle is being written";
  const synopsisText = synopsis?.synopsis?.trim() || "Your chronicle is being written.";
  const region = synopsis?.region?.trim() || (formInput?.runeterraRegion !== "Auto" ? formInput?.runeterraRegion : null) || null;
  const role = synopsis?.specificRole?.trim() || formInput?.characterType?.trim() || null;

  const scrollDuration = useMemo(() => getScrollDuration(synopsisText), [synopsisText]);

  const scrollStyle = {
    "--scroll-duration": `${scrollDuration}s`,
  } as React.CSSProperties;

  const metaParts = [region, role].filter(Boolean);

  return (
    <main className="post-video-loading-screen archive-shell relative flex min-h-dvh flex-col overflow-hidden px-[22px] py-6 sm:px-6">
      <div className="loading-background pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="loading-background-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <header className="fixed-legend-header shrink-0 text-center">
          <span className="loading-eyebrow font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#7eb6ff]/90">
            Your legend
          </span>
          <h1 className="legend-character-name font-cover-title mt-3 text-[#f7ebce]">{characterName}</h1>
          <h2 className="legend-nickname font-title mt-2 text-[#d9bd78]/90">{legendaryTitle}</h2>
          {metaParts.length > 0 ? (
            <p className="legend-meta mt-3 text-sm text-[#9baabd]">{metaParts.join(" · ")}</p>
          ) : null}
        </header>

        <div className="loading-indicator shrink-0" role="status" aria-live="polite">
          <div
            className="loading-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Preview generation progress"
          >
            <div className="loading-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="whitespace-pre-line">{loadingMessage || "Writing your illustrated chronicle..."}</span>
        </div>

        <div className="synopsis-scroll-container mx-auto w-full max-w-[680px]">
          <div className="synopsis-scroll-text" style={scrollStyle}>
            <p className="synopsis-loading-body font-cover-title">{synopsisText}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
