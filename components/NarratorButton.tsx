"use client";

import { cn } from "@/lib/utils";

type NarratorButtonProps = {
  onClick: () => void;
  isLoading?: boolean;
  isPlaying?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function NarratorButton({
  onClick,
  isLoading = false,
  isPlaying = false,
  disabled = false,
  className,
}: NarratorButtonProps) {
  const label = isLoading ? "Summoning narrator..." : isPlaying ? "Listening..." : "Narrator";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      title="Listen to this page"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#6b4a24]/20 bg-[#fff8e8]/55 px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#6b4a24]/85 transition hover:border-[#6b4a24]/35 hover:bg-[#fff8e8]/80 disabled:cursor-wait disabled:opacity-60",
        isPlaying ? "border-[#8a6231]/45 bg-[#f7ebce]/70 text-[#4a3018]" : null,
        className,
      )}
    >
      <SpeakerIcon isPlaying={isPlaying} />
      <span>{label}</span>
    </button>
  );
}

function SpeakerIcon({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
      {isPlaying ? (
        <>
          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
        </>
      ) : (
        <>
          <path
            d="M11 5 6 9H3v6h3l5 4V5zm4.24 2.76a7 7 0 010 8.48l1.42 1.42a9 9 0 000-12.72l-1.42 1.42zm2.83-2.83a11 11 0 010 15.54l1.42 1.42a13 13 0 000-18.38l-1.42 1.42z"
            fill="currentColor"
          />
        </>
      )}
    </svg>
  );
}
