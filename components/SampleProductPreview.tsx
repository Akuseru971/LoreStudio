"use client";

import { useEffect, useRef } from "react";
import { safeTrackClient } from "@/lib/safe-analytics-client";
import { cn } from "@/lib/utils";

export const MP3_SAMPLE_URL =
  "https://Video-Invocation.b-cdn.net/ElevenLabs_2026-06-30T10_46_58_Wolf_ivc_sp100_s50_sb75_v3.mp3";
export const PDF_SAMPLE_URL = "https://Video-Invocation.b-cdn.net/book%20(2).pdf";

type SampleProductPreviewProps = {
  title: string;
  subtitle: string;
  disabled?: boolean;
  className?: string;
  audioHeading?: string;
  pdfHeading?: string;
  pdfButtonLabel?: string;
  prominent?: boolean;
};

export default function SampleProductPreview({
  title,
  subtitle,
  disabled = false,
  className,
  audioHeading = "Sample audio chapter",
  pdfHeading = "Sample illustrated PDF",
  pdfButtonLabel = "Open sample PDF",
  prominent = false,
}: SampleProductPreviewProps) {
  const sectionViewTrackedRef = useRef(false);
  const audioPlayTrackedRef = useRef(false);

  useEffect(() => {
    if (sectionViewTrackedRef.current) {
      return;
    }

    sectionViewTrackedRef.current = true;
    safeTrackClient("sample_section_viewed");
  }, []);

  const handleAudioPlay = () => {
    if (audioPlayTrackedRef.current) {
      return;
    }

    audioPlayTrackedRef.current = true;
    safeTrackClient("sample_audio_played");
  };

  const handlePdfOpen = () => {
    safeTrackClient("sample_pdf_opened");
  };

  return (
    <section
      aria-label="Sample preview"
      className={cn(
        "mt-5 rounded-2xl border bg-black/22 p-4",
        prominent ? "border-[#d9bd78]/30 bg-[#d9bd78]/[0.07]" : "border-[#d9bd78]/14",
        className,
      )}
    >
      <h3 className="font-cover-title text-base leading-tight text-[#f7ebce]">{title}</h3>
      <p className="mt-1.5 text-xs leading-6 text-[#9baabd]">{subtitle}</p>

      <div className={cn("mt-3.5 space-y-3", prominent && "mt-3 space-y-2.5")}>
        <div>
          <p
            className={cn(
              "text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]",
              prominent && "text-[0.68rem] font-semibold tracking-[0.12em] text-[#d9bd78]/90",
            )}
          >
            {audioHeading}
          </p>
          <audio
            controls
            preload="none"
            className={cn("mt-2 h-9 w-full max-w-full", prominent && "mt-1.5 h-10")}
            src={MP3_SAMPLE_URL}
            onPlay={handleAudioPlay}
          >
            Your browser does not support the audio element.
          </audio>
        </div>

        <div>
          {prominent ? null : (
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">{pdfHeading}</p>
          )}
          <a
            href={disabled ? undefined : PDF_SAMPLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            onClick={handlePdfOpen}
            className={cn(
              "mt-2 flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-[#f7ebce] transition aria-disabled:pointer-events-none aria-disabled:opacity-60",
              prominent
                ? "border-[#d9bd78]/38 bg-[#d9bd78]/14 py-3 text-[0.72rem] font-bold tracking-[0.1em] hover:border-[#d9bd78]/55 hover:bg-[#d9bd78]/22"
                : "border-[#d9bd78]/24 bg-[#d9bd78]/10 hover:border-[#d9bd78]/40 hover:bg-[#d9bd78]/16",
            )}
          >
            {pdfButtonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
