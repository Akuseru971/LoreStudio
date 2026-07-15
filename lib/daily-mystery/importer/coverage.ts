import "server-only";

import { getApprovedContentItems } from "@/lib/daily-mystery/store";
import { fetchOfficialChampionCatalog } from "@/lib/daily-mystery/importer/official-champion-page";
import { isDailyMysterySchedulable } from "@/lib/daily-mystery/content-policy";

export type MysteryCoverageReport = {
  generatedAt: string;
  champions: {
    totalCurrent: number;
    imported: number;
    officialBiographies: number;
    missing: string[];
  };
  rejectedSources: string[];
  awaitingManualReview: number;
};

export async function buildCoverageReport(): Promise<MysteryCoverageReport> {
  const catalog = await fetchOfficialChampionCatalog();
  const approved = await getApprovedContentItems();

  const championItems = approved.filter((item) => item.target_type === "champion");
  const officialBiographies = championItems.filter((item) => isDailyMysterySchedulable(item)).length;
  const simplifiedMissing = catalog
    .filter((champion) => !championItems.some((item) => item.slug === `champion-${champion.slug}`))
    .map((champion) => champion.slug);

  return {
    generatedAt: new Date().toISOString(),
    champions: {
      totalCurrent: catalog.length,
      imported: championItems.length,
      officialBiographies,
      missing: simplifiedMissing,
    },
    rejectedSources: [],
    awaitingManualReview: approved.filter((item) => item.review_status === "needs_review").length,
  };
}
