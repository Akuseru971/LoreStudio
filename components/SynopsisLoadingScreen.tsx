"use client";

import { useMemo } from "react";
import type { ApprovedSynopsis } from "@/lib/types";

type SynopsisLoadingScreenProps = {
  synopsis: ApprovedSynopsis | null;
  protagonistName?: string | null;
};

function getScrollDuration(synopsisText: string) {
  const synopsisLength = synopsisText.length || 0;
  return Math.min(28, Math.max(16, synopsisLength / 35));
}

export default function SynopsisLoadingScreen({ synopsis, protagonistName }: SynopsisLoadingScreenProps) {
  const legendaryTitle = synopsis?.legendaryTitle?.trim() || "The chronicle is being written";
  const synopsisText =
    synopsis?.synopsis?.trim() || "Your legend is taking shape. The first pages are being prepared.";
  const championName = synopsis?.championConnection?.championName?.trim() || null;
  const connectionSummary = synopsis?.championConnection?.connectionSummary?.trim() || null;
  const region = synopsis?.region?.trim() || null;
  const specificRole = synopsis?.specificRole?.trim() || null;
  const protagonist = protagonistName?.trim() || null;

  const scrollDuration = useMemo(() => getScrollDuration(synopsisText), [synopsisText]);

  const scrollStyle = {
    "--scroll-duration": `${scrollDuration}s`,
  } as React.CSSProperties;

  return (
    <main className="synopsis-loading-screen archive-shell relative flex min-h-dvh flex-col overflow-hidden px-4 py-6 sm:px-6">
      <div className="loading-background pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="loading-background-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="synopsis-scroll-container flex-1">
          <div className="synopsis-scroll-text" style={scrollStyle}>
            <span className="loading-eyebrow font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#7eb6ff]/90">
              The chronicle is being written
            </span>

            <h2 className="synopsis-loading-title font-cover-title mt-4 text-[#f7ebce]">{legendaryTitle}</h2>

            {(region || specificRole || protagonist) && (
              <dl className="synopsis-loading-meta mt-4 grid gap-3 sm:grid-cols-2">
                {protagonist ? (
                  <div>
                    <dt className="text-[0.58rem] uppercase tracking-[0.22em] text-[#9baabd]">Legend</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">{protagonist}</dd>
                  </div>
                ) : null}
                {region ? (
                  <div>
                    <dt className="text-[0.58rem] uppercase tracking-[0.22em] text-[#9baabd]">Region</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">{region}</dd>
                  </div>
                ) : null}
                {specificRole ? (
                  <div className={protagonist && region ? "sm:col-span-2" : undefined}>
                    <dt className="text-[0.58rem] uppercase tracking-[0.22em] text-[#9baabd]">Role</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">{specificRole}</dd>
                  </div>
                ) : null}
              </dl>
            )}

            <p className="synopsis-loading-body mt-5 text-[#c9d3df]">{synopsisText}</p>

            {championName ? (
              <div className="loading-connected-champion mt-6 rounded-2xl border border-[#d9bd78]/18 bg-black/20 px-4 py-4 text-center">
                <span className="font-title text-[0.58rem] uppercase tracking-[0.28em] text-[#d9bd78]/80">
                  Connected champion
                </span>
                <strong className="mt-2 block text-base text-[#f7ebce]">{championName}</strong>
                {connectionSummary ? (
                  <p className="mt-2 text-sm leading-6 text-[#9baabd]">{connectionSummary}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="loading-status shrink-0 pt-4 text-center">
          <p className="font-title text-[0.62rem] uppercase tracking-[0.3em] text-[#d9bd78]/85">
            Preparing your illustrated book...
          </p>
          <div className="loading-status-line mx-auto mt-3 h-px w-32 bg-gradient-to-r from-transparent via-[#d9bd78]/55 to-transparent" />
        </div>
      </div>
    </main>
  );
}
