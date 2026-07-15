import "server-only";

import type { MysteryContentItem, MysterySourceType } from "@/lib/daily-mystery/types";
import { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";
import {
  buildOfficialChampionPageUrl,
  isOfficialChampionBiographyUrl,
  parseOfficialChampionSlug,
} from "@/lib/daily-mystery/content-policy";
import { hashSourceText } from "@/lib/daily-mystery/tokenize";
import { upsertContentItem } from "@/lib/daily-mystery/store";
import { precomputeContentEmbeddings } from "@/lib/daily-mystery/semantic";
import { getUniqueLemmas, tokenizePassage } from "@/lib/daily-mystery/tokenize";
import {
  championKeyFromPage,
  extractOfficialChampionBiography,
  parseOfficialChampionNextData,
} from "@/lib/daily-mystery/importer/official-champion-page-parser";

type ChampionCatalogItem = {
  slug: string;
  name: string;
};

export { extractOfficialChampionBiography } from "@/lib/daily-mystery/importer/official-champion-page-parser";

export async function fetchOfficialChampionCatalog(): Promise<ChampionCatalogItem[]> {
  const response = await fetch("https://www.leagueoflegends.com/en-us/champions/", {
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    throw new Error("Unable to fetch official champion catalog.");
  }

  const html = await response.text();
  const data = parseOfficialChampionNextData(html);
  const asyncBlade = data.props?.pageProps?.page?.blades?.find(
    (blade) => (blade as { type?: string }).type === "async",
  ) as { items?: Array<{ title?: string; action?: { payload?: { url?: string } } }> } | undefined;
  const items = asyncBlade?.items;

  const catalog: ChampionCatalogItem[] = [];
  for (const item of items ?? []) {
    const url = item.action?.payload?.url;
    const slug = url ? parseOfficialChampionSlug(`https://www.leagueoflegends.com${url}`) : null;
    const name = item.title?.trim();
    if (!slug || !name) {
      continue;
    }
    catalog.push({ slug, name });
  }

  return catalog;
}

export async function fetchOfficialChampionBiography(championSlug: string) {
  const sourceUrl = buildOfficialChampionPageUrl(championSlug);
  const response = await fetch(sourceUrl, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`Unable to load official champion page for ${championSlug}.`);
  }

  const html = await response.text();
  const data = parseOfficialChampionNextData(html);
  const page = data.props?.pageProps?.page;
  if (!page) {
    throw new Error(`Official champion page payload missing for ${championSlug}.`);
  }

  const extracted = extractOfficialChampionBiography(page);
  if (!extracted) {
    throw new Error(`Official biography text missing for ${championSlug}.`);
  }
  if (extracted.sourceText.length < 120) {
    throw new Error(`Official biography text too short for ${championSlug}.`);
  }

  if (!isOfficialChampionBiographyUrl(sourceUrl)) {
    throw new Error(`Rejected non-allowlisted champion source URL for ${championSlug}.`);
  }

  return {
    championSlug: championSlug.toLowerCase(),
    championKey: championKeyFromPage(page, championSlug.toLowerCase()),
    sourceUrl,
    sourceHost: new URL(sourceUrl).hostname.replace(/^www\./, ""),
    ...extracted,
  };
}

export async function importChampionFromOfficialPage({
  championSlug,
  locale = "en_US",
  reviewStatus = "needs_review",
  regionTags = [],
  difficulty = 3,
  aliases = [],
}: {
  championSlug: string;
  locale?: string;
  reviewStatus?: MysteryContentItem["review_status"];
  regionTags?: string[];
  difficulty?: number;
  aliases?: string[];
}) {
  const biography = await fetchOfficialChampionBiography(championSlug);
  const sourceType: MysterySourceType = "official_champion_biography";
  const protectedTerms = buildChampionProtectedTerms(biography.canonicalTitle, [
    biography.subtitle,
    ...aliases,
  ]);
  const slug = `champion-${biography.championSlug}`;

  const item = await upsertContentItem({
    slug,
    locale,
    target_type: "champion",
    canonical_title: biography.canonicalTitle,
    protected_terms: protectedTerms,
    accepted_solution_aliases: aliases,
    source_text: biography.sourceText,
    source_url: biography.sourceUrl,
    source_domain: "www.leagueoflegends.com",
    source_type: sourceType,
    source_hash: hashSourceText(biography.sourceText),
    riot_content_version: null,
    ddragon_version: null,
    difficulty,
    region_tags: regionTags,
    related_champion_ids: [biography.championKey],
    hint_metadata: {
      category_label: "champion",
      region_label: regionTags[0],
      period_label: "A defining chapter in Runeterra's history.",
      daily_mystery_ineligible: false,
    },
    review_status: reviewStatus,
  });

  const { tokens } = tokenizePassage(item.source_text, item.protected_terms);
  await precomputeContentEmbeddings(item.id, getUniqueLemmas(tokens));

  console.info("[OFFICIAL_CHAMPION_BIO_IMPORTED]", {
    championSlug: biography.championSlug,
    sourceHost: "www.leagueoflegends.com",
    sourceValidated: true,
  });

  return item;
}

export async function importOfficialChampionCatalog({
  limit,
  autoApprove = false,
}: {
  limit?: number;
  autoApprove?: boolean;
} = {}) {
  const catalog = await fetchOfficialChampionCatalog();
  const selected = typeof limit === "number" ? catalog.slice(0, limit) : catalog;
  const report = {
    totalCurrentChampions: catalog.length,
    imported: 0,
    skipped: [] as string[],
    rejected: [] as string[],
    awaitingReview: 0,
  };

  for (const champion of selected) {
    try {
      const imported = await importChampionFromOfficialPage({
        championSlug: champion.slug,
        reviewStatus: autoApprove ? "approved" : "needs_review",
      });

      report.imported += 1;
      if (imported.review_status !== "approved") {
        report.awaitingReview += 1;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.rejected.push(`${champion.slug}: ${reason}`);
      console.info("[OFFICIAL_CHAMPION_BIO_SKIPPED]", {
        championSlug: champion.slug,
        safeReason: reason,
      });
    }
  }

  return report;
}
