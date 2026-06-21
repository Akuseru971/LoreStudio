"use client";

import { motion } from "framer-motion";
import MagicalBackground from "@/components/MagicalBackground";
import type { ApprovedSynopsis } from "@/lib/types";

type SynopsisPreviewProps = {
  synopsis: ApprovedSynopsis | null;
  isLoading: boolean;
  error: string | null;
  regenerationLimitReached: boolean;
  onCreateLegend: () => void;
  onTryAnotherDirection: () => void;
  onEditAnswers: () => void;
  onRetry: () => void;
  isCreating?: boolean;
};

export default function SynopsisPreview({
  synopsis,
  isLoading,
  error,
  regenerationLimitReached,
  onCreateLegend,
  onTryAnotherDirection,
  onEditAnswers,
  onRetry,
  isCreating = false,
}: SynopsisPreviewProps) {
  return (
    <main className="archive-shell relative min-h-screen overflow-y-auto px-5 py-10 md:px-8">
      <MagicalBackground intensity="form" />
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="glass-panel w-full rounded-[2rem] p-6 sm:p-8"
        >
          <div className="text-center">
            <p className="font-title text-xs uppercase tracking-[0.38em] text-[#7eb6ff]">First omen</p>
            <h1 className="font-title mt-3 text-3xl text-[#f7ebce] sm:text-4xl">Your legend takes shape</h1>
          </div>

          {isLoading ? (
            <div className="mt-10 text-center">
              <p className="text-sm uppercase tracking-[0.22em] text-[#9baabd]">Opening the first omen…</p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-8 rounded-2xl border border-red-400/25 bg-red-950/30 px-5 py-4 text-center">
              <p className="text-sm leading-7 text-red-200">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-2xl border border-red-300/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-red-100"
              >
                Try again
              </button>
            </div>
          ) : null}

          {synopsis && !isLoading ? (
            <div className="mt-8">
              <div className="rounded-[1.5rem] border border-[#d9bd78]/20 bg-black/20 p-6 sm:p-7">
                <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
                  Legendary title
                </p>
                <h2 className="font-cover-title mt-2 text-2xl leading-tight text-[#f7ebce] sm:text-3xl">
                  {synopsis.legendaryTitle}
                </h2>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.24em] text-[#9baabd]">Region</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">{synopsis.region}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.24em] text-[#9baabd]">Role</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">{synopsis.specificRole}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[0.62rem] uppercase tracking-[0.24em] text-[#9baabd]">Connected champion</dt>
                    <dd className="mt-1 text-sm text-[#e8dcc0]">
                      {synopsis.championConnection.championName} — {synopsis.championConnection.connectionSummary}
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 text-sm leading-7 text-[#c9d3df]">{synopsis.synopsis}</p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onCreateLegend}
                  disabled={isCreating}
                  className="gold-button rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70"
                >
                  {isCreating ? "Summoning your legend…" : "Create my legend"}
                </button>
                <button
                  type="button"
                  onClick={onTryAnotherDirection}
                  disabled={regenerationLimitReached || isCreating}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d3df] transition hover:border-[#d9bd78]/30 hover:text-[#f7ebce] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Try another direction
                </button>
                {regenerationLimitReached ? (
                  <p className="text-center text-xs text-[#9baabd]">
                    Edit your answers to explore a new direction.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={onEditAnswers}
                  disabled={isCreating}
                  className="rounded-2xl border border-white/10 bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:text-[#e8dcc0] disabled:opacity-50"
                >
                  Edit my answers
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </section>
    </main>
  );
}
