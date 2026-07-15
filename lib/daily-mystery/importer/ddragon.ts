import { createHash } from "crypto";
import type { MysteryContentItem, MysterySourceType, MysteryTargetType } from "@/lib/daily-mystery/types";
import { hashSourceText } from "@/lib/daily-mystery/tokenize";
import { upsertContentItem } from "@/lib/daily-mystery/store";
import { precomputeContentEmbeddings } from "@/lib/daily-mystery/semantic";
import { tokenizePassage, getUniqueLemmas } from "@/lib/daily-mystery/tokenize";

export type DDragonChampion = {
  id: string;
  key: string;
  name: string;
  title: string;
  lore?: string;
  blurb?: string;
};

export async function fetchDDragonVersion() {
  const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    throw new Error("Unable to fetch Data Dragon versions.");
  }
  const versions = (await response.json()) as string[];
  return versions[0] || "15.13.1";
}

export async function fetchDDragonChampions(version: string, locale = "en_US") {
  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion.json`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok) {
    throw new Error("Unable to fetch Data Dragon champion list.");
  }
  const payload = (await response.json()) as { data: Record<string, DDragonChampion> };
  return Object.values(payload.data);
}

export async function fetchDDragonChampionDetail(
  version: string,
  championId: string,
  locale = "en_US",
) {
  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${championId}.json`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok) {
    throw new Error(`Unable to fetch champion detail for ${championId}.`);
  }
  const payload = (await response.json()) as { data: Record<string, DDragonChampion & { lore: string }> };
  return Object.values(payload.data)[0]!;
}


export { isOfficialDomain } from "@/lib/daily-mystery/official-source";
export { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";
import { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";

export async function importChampionFromDDragon({
  championId,
  locale = "en_US",
  reviewStatus = "needs_review",
  regionTags = [],
  difficulty = 3,
  aliases = [],
}: {
  championId: string;
  locale?: string;
  reviewStatus?: MysteryContentItem["review_status"];
  regionTags?: string[];
  difficulty?: number;
  aliases?: string[];
}) {
  const version = await fetchDDragonVersion();
  const champion = await fetchDDragonChampionDetail(version, championId, locale);
  const sourceText = champion.lore?.trim() || champion.blurb?.trim();
  if (!sourceText) {
    throw new Error(`Champion ${championId} has no official lore or blurb.`);
  }

  const sourceUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${championId}.json`;
  const sourceType: MysterySourceType = champion.lore?.trim() ? "full_biography" : "official_blurb";
  const protectedTerms = buildChampionProtectedTerms(champion.name, aliases);
  const slug = `champion-${champion.id.toLowerCase()}`;

  const item = await upsertContentItem({
    slug,
    locale,
    target_type: "champion",
    canonical_title: champion.name,
    protected_terms: protectedTerms,
    accepted_solution_aliases: aliases,
    source_text: sourceText,
    source_url: sourceUrl,
    source_domain: "ddragon.leagueoflegends.com",
    source_type: sourceType,
    source_hash: hashSourceText(sourceText),
    riot_content_version: version,
    ddragon_version: version,
    difficulty,
    region_tags: regionTags,
    related_champion_ids: [champion.key],
    hint_metadata: {
      category_label: "champion",
      region_label: regionTags[0],
      period_label: "A defining chapter in Runeterra's history.",
      multiple_choice_options: undefined,
    },
    review_status: reviewStatus,
  });

  const { tokens } = tokenizePassage(item.source_text, item.protected_terms);
  await precomputeContentEmbeddings(item.id, getUniqueLemmas(tokens));

  return item;
}

export async function importChampionCatalog({
  limit,
  autoApprove = false,
}: {
  limit?: number;
  autoApprove?: boolean;
} = {}) {
  const version = await fetchDDragonVersion();
  const champions = await fetchDDragonChampions(version);
  const selected = typeof limit === "number" ? champions.slice(0, limit) : champions;
  const report = {
    version,
    totalCurrentChampions: champions.length,
    imported: 0,
    fullBiography: 0,
    officialBlurb: 0,
    missing: [] as string[],
    rejected: [] as string[],
    awaitingReview: 0,
  };

  for (const champion of selected) {
    try {
      const detail = await fetchDDragonChampionDetail(version, champion.id);
      const sourceText = detail.lore?.trim() || detail.blurb?.trim();
      if (!sourceText) {
        report.missing.push(champion.id);
        continue;
      }

      const imported = await importChampionFromDDragon({
        championId: champion.id,
        reviewStatus: autoApprove ? "approved" : "needs_review",
      });

      report.imported += 1;
      if (imported.source_type === "full_biography") {
        report.fullBiography += 1;
      } else {
        report.officialBlurb += 1;
      }
      if (imported.review_status !== "approved") {
        report.awaitingReview += 1;
      }
    } catch (error) {
      report.rejected.push(`${champion.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

export function hashImportPayload(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export type ManualManifestEntry = {
  slug: string;
  target_type: MysteryTargetType;
  canonical_title: string;
  protected_terms: string[];
  accepted_solution_aliases?: string[];
  source_text: string;
  source_url: string;
  source_type: MysterySourceType;
  locale?: string;
  difficulty?: number;
  region_tags?: string[];
  related_champion_ids?: string[];
  hint_metadata?: MysteryContentItem["hint_metadata"];
  review_status?: MysteryContentItem["review_status"];
  riot_content_version?: string | null;
  ddragon_version?: string | null;
};

export async function importFromManualManifest(entries: ManualManifestEntry[]) {
  const { importVerifiedSeedManifest } = await import("@/lib/daily-mystery/bootstrap");
  const report = await importVerifiedSeedManifest(entries);
  const results = [];
  for (const slug of [...report.inserted, ...report.skipped]) {
    const { getContentItemBySlug } = await import("@/lib/daily-mystery/store");
    const item = await getContentItemBySlug(slug);
    if (item) {
      results.push(item);
    }
  }
  if (report.rejected.length > 0) {
    throw new Error(report.rejected.join("; "));
  }
  return results;
}
