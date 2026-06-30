"use client";

import { useEffect, useRef } from "react";
import { safeTrackClient } from "@/lib/safe-analytics-client";

export const MP3_SAMPLE_URL =
  "https://Video-Invocation.b-cdn.net/ElevenLabs_2026-06-30T10_46_58_Wolf_ivc_sp100_s50_sb75_v3.mp3";
export const PDF_SAMPLE_URL = "https://Video-Invocation.b-cdn.net/book%20(2).pdf";

type SampleProductPreviewProps = {
  title: string;
  subtitle: string;
  disabled?: boolean;
};

export default function SampleProductPreview({ title, subtitle, disabled = false }: SampleProductPreviewProps) {
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
    <section aria-label="Sample preview" className="mt-5 rounded-2xl border border-[#d9bd78]/14 bg-black/22 p-4">
      <h3 className="font-cover-title text-base leading-tight text-[#f7ebce]">{title}</h3>
      <p className="mt-1.5 text-xs leading-6 text-[#9baabd]">{subtitle}</p>

      <div className="mt-3.5 space-y-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">Sample audio chapter</p>
          <audio
            controls
            preload="none"
            className="mt-2 h-9 w-full max-w-full"
            src={MP3_SAMPLE_URL}
            onPlay={handleAudioPlay}
          >
            Your browser does not support the audio element.
          </audio>
        </div>

        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">Sample illustrated PDF</p>
          <a
            href={disabled ? undefined : PDF_SAMPLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            onClick={handlePdfOpen}
            className="mt-2 flex w-full items-center justify-center rounded-xl border border-[#d9bd78]/24 bg-[#d9bd78]/10 px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-[#f7ebce] transition hover:border-[#d9bd78]/40 hover:bg-[#d9bd78]/16 aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            Open sample PDF
          </a>
        </div>
      </div>
    </section>
  );
}
