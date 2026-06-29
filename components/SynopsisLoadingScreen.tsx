// MVP LOCKED DESIGN:
// Do not modify this preview/loading design unless explicitly requested.
// Only change this component for direct UI requests targeting it.

"use client";

import { useMemo } from "react";
import type { ApprovedSynopsis, BookFormInput } from "@/lib/types";

type SynopsisLoadingScreenProps = {
  synopsis: ApprovedSynopsis | null;
  formInput?: BookFormInput | null;
  loadingMessage?: string;
};

function getScrollDuration(synopsisText: string) {
  const synopsisLength = synopsisText.length || 0;
  const baseScrollDuration = Math.min(28, Math.max(16, synopsisLength / 35));
  return baseScrollDuration * 2;
}

export default function SynopsisLoadingScreen({ synopsis, formInput, loadingMessage }: SynopsisLoadingScreenProps) {
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
          <div className="loading-rune" aria-hidden="true" />
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
