"use client";

import { getRegionChampions } from "@/lib/runeterra-form-lore";

type ChampionExamplesProps = {
  region: string;
};

export default function ChampionExamples({ region }: ChampionExamplesProps) {
  if (!region) {
    return null;
  }

  if (region === "Auto") {
    return (
      <p className="mt-3 text-xs leading-5 text-[#9baabd]">
        Let the archive choose the region that fits your legend.
      </p>
    );
  }

  const champions = getRegionChampions(region);
  if (!champions.length) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[#9baabd]">Known champions from this region</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {champions.map((champion) => (
          <span
            key={champion}
            className="rounded-full border border-[#7eb6ff]/18 bg-[#07101c]/70 px-2.5 py-1 text-[0.68rem] tracking-wide text-[#c9d3df]"
          >
            {champion}
          </span>
        ))}
      </div>
    </div>
  );
}
