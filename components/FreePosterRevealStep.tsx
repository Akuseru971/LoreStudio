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
      className={cn(
        "free-poster-reveal legend-reveal-overlay legend-reveal-overlay--embedded relative overflow-hidden rounded-[1.75rem]",
        className,
      )}
      aria-label="Premium poster reveal"
    >
      <div className="legend-reveal-vignette" aria-hidden="true" />

      <div className="legend-reveal-content legend-reveal-content--poster relative z-[2] w-full max-w-none px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-7">
        {onPrevious ? (
          <div className="legend-reveal-toolbar mb-4 w-full max-w-[min(100%,28rem)] sm:mb-5">
            <button
              type="button"
              onClick={onPrevious}
              className="legend-reveal-back-btn"
              aria-label="Back to previous pages"
            >
              Back
            </button>
          </div>
        ) : null}

        <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#7eb6ff]/85">
          Collector edition reveal
        </p>

        <div className="legend-reveal-identity mt-3 sm:mt-4">
          <h2 className="legend-reveal-name font-cover-title">{championName}</h2>
          {legendaryTitle ? <p className="legend-reveal-subtitle font-title">{legendaryTitle}</p> : null}
          {region ? (
            <div className="legend-reveal-region">
              <span className="legend-reveal-region-seal bg-[radial-gradient(circle,rgba(126,182,255,0.45),rgba(126,182,255,0.08))]" />
              <span className="text-[0.68rem] uppercase tracking-[0.22em] text-[#9baabd]">{region}</span>
            </div>
          ) : null}
        </div>

        <div className="legend-reveal-frame legend-reveal-frame--poster mx-auto mt-4 w-full max-w-[min(100%,28rem)] sm:mt-5">
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

            {onUnlockClick ? (
              <div className="legend-reveal-unlock-overlay" aria-hidden={false}>
                <button
                  type="button"
                  onClick={onUnlockClick}
                  className="legend-reveal-unlock-btn gold-button"
                >
                  Unlock Full Book
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <p className="legend-reveal-followup legend-reveal-followup--poster mt-4 max-w-md sm:mt-5">
          Your legend continues beyond this reveal. Unlock the full illustrated chronicle to read every sealed
          chapter.
        </p>
      </div>
    </section>
  );
}
