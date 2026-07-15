import "server-only";

import { getApprovedContentItems } from "@/lib/daily-mystery/store";
import { fetchDDragonChampions, fetchDDragonVersion } from "@/lib/daily-mystery/importer/ddragon";

export type MysteryCoverageReport = {
  generatedAt: string;
  ddragonVersion: string;
  champions: {
    totalCurrent: number;
    imported: number;
    fullBiography: number;
    officialBlurb: number;
    missing: string[];
  };
  regions: { imported: number };
  events: { imported: number };
  otherSubjects: { imported: number };
  rejectedSources: string[];
  awaitingManualReview: number;
};

export async function buildCoverageReport(): Promise<MysteryCoverageReport> {
  const version = await fetchDDragonVersion();
  const champions = await fetchDDragonChampions(version);
  const approved = await getApprovedContentItems();

  const championItems = approved.filter((item) => item.target_type === "champion");
  const simplifiedMissing = champions
    .filter((champion) => !championItems.some((item) => item.slug === `champion-${champion.id.toLowerCase()}`))
    .map((champion) => champion.id);

  const fullBiography = championItems.filter((item) => item.source_type === "full_biography").length;
  const officialBlurb = championItems.filter((item) => item.source_type === "official_blurb").length;

  return {
    generatedAt: new Date().toISOString(),
    ddragonVersion: version,
    champions: {
      totalCurrent: champions.length,
      imported: championItems.length,
      fullBiography,
      officialBlurb,
      missing: simplifiedMissing,
    },
    regions: {
      imported: approved.filter((item) => item.target_type === "region").length,
    },
    events: {
      imported: approved.filter((item) => item.target_type === "event").length,
    },
    otherSubjects: {
      imported: approved.filter((item) =>
        ["place", "faction", "artifact", "species", "legendary_npc", "other"].includes(item.target_type),
      ).length,
    },
    rejectedSources: [],
    awaitingManualReview: approved.filter((item) => item.review_status === "needs_review").length,
  };
}
