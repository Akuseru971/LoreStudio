"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type ArchiveEntry = {
  slug: string;
  puzzlePublicId: string;
  scheduleDate: string;
  displayLabel: string;
  targetType: string;
  difficulty: number;
  regionTags: string[];
};

export default function DailyMysteryArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [targetType, setTargetType] = useState("");
  const [region, setRegion] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (targetType) params.set("targetType", targetType);
    if (region) params.set("region", region);
    if (difficulty) params.set("difficulty", difficulty);

    void fetch(`/api/daily-mystery/archive?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setEntries(data.entries ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [difficulty, region, targetType]);

  return (
    <>
      <SiteHeader />
      <main className="daily-mystery-shell">
        <section className="daily-mystery-hero">
          <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">Chronicle Archive</p>
          <h1 className="font-cover-title mt-2 text-3xl text-[#f7ebce]">Practice the Archives</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#b8c2d0]">
            Replay previously published Chronicles. Archive progress does not affect your official daily streak.
          </p>
        </section>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <select
            value={targetType}
            onChange={(event) => {
              setLoading(true);
              setTargetType(event.target.value);
            }}
            className="daily-mystery-select"
          >
            <option value="">All types</option>
            <option value="champion">Champion</option>
            <option value="region">Region</option>
            <option value="event">Event</option>
            <option value="faction">Faction</option>
          </select>
          <input
            value={region}
            onChange={(event) => {
              setLoading(true);
              setRegion(event.target.value);
            }}
            placeholder="Filter by region"
            className="daily-mystery-select"
          />
          <select
            value={difficulty}
            onChange={(event) => {
              setLoading(true);
              setDifficulty(event.target.value);
            }}
            className="daily-mystery-select"
          >
            <option value="">All difficulties</option>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={String(level)}>
                Difficulty {level}
              </option>
            ))}
          </select>
        </div>

        {loading ? <p className="text-[#9baabd]">Loading archive...</p> : null}
        <div className="grid gap-3">
          {entries.map((entry) => (
            <Link key={entry.slug} href={`/daily-mystery/archive/${entry.slug}`} className="glass-panel daily-mystery-archive-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-cover-title text-xl text-[#f7ebce]">{entry.displayLabel}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9baabd]">
                    {entry.targetType.replace(/_/g, " ")} · {entry.scheduleDate}
                  </p>
                </div>
                <span className="text-xs text-[#d9bd78]">Difficulty {entry.difficulty}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
