"use client";

import { motion } from "framer-motion";
import type { AudioSettings } from "@/lib/types";

type AudioControlsProps = {
  settings: AudioSettings;
  musicAvailable: boolean;
  isLoadingVoice?: boolean;
  onToggleMusic: () => void;
  onToggleVoice: () => void;
  onReplayVoice: () => void;
};

export default function AudioControls({
  settings,
  musicAvailable,
  isLoadingVoice = false,
  onToggleMusic,
  onToggleVoice,
  onReplayVoice,
}: AudioControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-6 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl"
    >
      {musicAvailable ? (
        <ControlButton active={settings.musicEnabled} onClick={onToggleMusic}>
          Music {settings.musicEnabled ? "on" : "off"}
        </ControlButton>
      ) : null}

      <ControlButton active={settings.voiceEnabled} onClick={onToggleVoice}>
        Voice {settings.voiceEnabled ? "on" : "off"}
      </ControlButton>

      <button
        type="button"
        onClick={onReplayVoice}
        disabled={!settings.voiceEnabled || isLoadingVoice}
        className="rounded-full border border-[#d9bd78]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f7ebce] transition hover:border-[#d9bd78]/60 hover:bg-[#d9bd78]/10 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isLoadingVoice ? "Summoning voice..." : "Replay narration"}
      </button>
    </motion.div>
  );
}

function ControlButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
        active
          ? "border-[#d9bd78]/55 bg-[#d9bd78]/15 text-[#f7ebce]"
          : "border-white/10 bg-white/[0.03] text-[#9baabd] hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}
