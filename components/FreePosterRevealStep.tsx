"use client";

import { cn } from "@/lib/utils";

type FreePosterRevealStepProps = {
  championName: string;
  legendaryTitle?: string | null;
  region?: string | null;
  posterImageUrl?: string | null;
  isImageLoading?: boolean;
  onUnlockClick?: () => void;
  onPrevious?: () => void;
  className?: string;
};

export default function FreePosterRevealStep({
  championName,
  legendaryTitle,
  region,
  posterImageUrl,
  isImageLoading = false,
  onUnlockClick,
  onPrevious,
  className,
}: FreePosterRevealStepProps) {
  return (
    <section
      className={cn("free-poster-reveal legend-reveal-overlay legend-reveal-overlay--embedded relative overflow-hidden rounded-[1.75rem]", className)}
      aria-label="Premium poster reveal"
    >
      <div className="legend-reveal-vignette" aria-hidden="true" />

      <div className="legend-reveal-content relative z-[2] w-full max-w-none px-4 py-6 sm:px-6 sm:py-8">
        <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#7eb6ff]/85">Collector edition reveal</p>

        <div className="legend-reveal-identity mt-4">
          <h2 className="legend-reveal-name font-cover-title">{championName}</h2>
          {legendaryTitle ? <p className="legend-reveal-subtitle font-title">{legendaryTitle}</p> : null}
          {region ? (
            <div className="legend-reveal-region">
              <span className="legend-reveal-region-seal bg-[radial-gradient(circle,rgba(126,182,255,0.45),rgba(126,182,255,0.08))]" />
              <span className="text-[0.68rem] uppercase tracking-[0.22em] text-[#9baabd]">{region}</span>
            </div>
          ) : null}
        </div>

        <div className="legend-reveal-frame mx-auto mt-5 w-full max-w-[min(100%,28rem)]">
          <div className="legend-reveal-frame-inner">
            <div className="legend-reveal-frame-glow" aria-hidden="true" />
            {posterImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterImageUrl}
                alt={`${championName} premium poster`}
                className="legend-reveal-image legend-reveal-image--poster"
              />
            ) : (
              <div className="legend-reveal-image-placeholder">
                <div className="legend-reveal-shimmer" aria-hidden="true" />
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#9baabd]/80">
                  {isImageLoading ? "Forging your collector poster..." : "Poster waiting in the mist"}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="legend-reveal-followup mt-5 max-w-md">
          Your legend continues beyond this reveal. Unlock the full illustrated chronicle to read every sealed chapter.
        </p>

        <div className="mt-6 flex w-full max-w-md flex-col gap-3">
          {onUnlockClick ? (
            <button
              type="button"
              onClick={onUnlockClick}
              className="gold-button w-full rounded-2xl px-5 py-3.5 text-xs font-bold uppercase tracking-[0.22em]"
            >
              Unlock full book
            </button>
          ) : null}
          {onPrevious ? (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/30 hover:text-[#e8dcc0]"
            >
              Back to the story
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
