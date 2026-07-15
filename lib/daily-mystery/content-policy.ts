import type { MysteryContentItem, MysteryHintMetadata } from "@/lib/daily-mystery/types";
import { localesMatch } from "@/lib/daily-mystery/locale";
import { hashSourceText } from "@/lib/daily-mystery/tokenize";

export const DAILY_MYSTERY_SCHEDULABLE_TYPES = ["champion"] as const;

export const OFFICIAL_CHAMPION_PAGE_HOST = "www.leagueoflegends.com";

const DISALLOWED_SOURCE_HOST_PATTERNS = [
  /^ddragon\.leagueoflegends\.com$/i,
  /^universe\.leagueoflegends\.com$/i,
  /^raw\.communitydragon\.org$/i,
] as const;

const DISALLOWED_SOURCE_URL_PATTERNS = [
  /ddragon\.leagueoflegends\.com/i,
  /universe\.leagueoflegends\.com/i,
  /communitydragon/i,
  /\/cdn\//i,
  /\/api\//i,
  /\.json(?:$|[?#])/i,
] as const;

const OFFICIAL_CHAMPION_PAGE_PATH = /^\/en-us\/champions\/[a-z0-9]+\/?$/i;

export function normalizeOfficialChampionHostname(hostname: string) {
  return hostname.toLowerCase();
}

export function getSafeSourceHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid";
  }
}

export function isDisallowedDailyMysterySourceUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = normalizeOfficialChampionHostname(parsed.hostname);
    if (DISALLOWED_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
      return true;
    }
    return DISALLOWED_SOURCE_URL_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    return true;
  }
}

export function buildOfficialChampionPageUrl(championSlug: string) {
  return `https://www.leagueoflegends.com/en-us/champions/${championSlug.toLowerCase()}/`;
}

export function parseOfficialChampionSlug(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/en-us\/champions\/([a-z0-9]+)\/?$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function isOfficialChampionBiographyUrl(url: string) {
  if (isDisallowedDailyMysterySourceUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = normalizeOfficialChampionHostname(parsed.hostname);
    if (host !== OFFICIAL_CHAMPION_PAGE_HOST) {
      return false;
    }
    if (parsed.search || parsed.hash) {
      return false;
    }
    return OFFICIAL_CHAMPION_PAGE_PATH.test(parsed.pathname) && parseOfficialChampionSlug(url) != null;
  } catch {
    return false;
  }
}

export function isOfficialChampionBiographyContent(
  item: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "source_text" | "source_hash">,
) {
  if (item.target_type !== "champion") {
    return false;
  }
  if (item.source_type !== "official_champion_biography") {
    return false;
  }
  if (!localesMatch(item.locale, "en_US")) {
    return false;
  }
  if (!item.source_text?.trim()) {
    return false;
  }
  if (!isOfficialChampionBiographyUrl(item.source_url)) {
    return false;
  }
  if (item.source_hash !== hashSourceText(item.source_text)) {
    return false;
  }
  return true;
}

export function classifyDisallowedDailyMysterySource(
  item: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale">,
) {
  if (item.target_type !== "champion") {
    return "non_champion";
  }
  if (!localesMatch(item.locale, "en_US")) {
    return "non_english";
  }
  if (/ddragon\.leagueoflegends\.com/i.test(item.source_url) || item.source_type === "full_biography") {
    return "ddragon";
  }
  if (/universe\.leagueoflegends\.com/i.test(item.source_url) || item.source_type === "official_page") {
    return "universe";
  }
  if (isDisallowedDailyMysterySourceUrl(item.source_url)) {
    return "third_party";
  }
  if (!isOfficialChampionBiographyUrl(item.source_url) || item.source_type !== "official_champion_biography") {
    return "unsupported_source";
  }
  return null;
}

function isExplicitlyIneligible(hintMetadata: MysteryHintMetadata | undefined) {
  return hintMetadata?.daily_mystery_ineligible === true;
}

export function isDailyMysterySchedulable(
  item: Pick<
    MysteryContentItem,
    | "target_type"
    | "source_type"
    | "source_url"
    | "locale"
    | "source_text"
    | "source_hash"
    | "review_status"
    | "retired_at"
    | "hint_metadata"
  >,
) {
  if (item.review_status !== "approved" || item.retired_at != null) {
    return false;
  }
  if (isExplicitlyIneligible(item.hint_metadata)) {
    return false;
  }
  return isOfficialChampionBiographyContent(item);
}

export function isDailyMysterySeedEntry(
  entry: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "source_text">,
) {
  if (entry.target_type !== "champion" || entry.source_type !== "official_champion_biography") {
    return false;
  }
  if (!localesMatch(entry.locale, "en_US") || !entry.source_text?.trim()) {
    return false;
  }
  return isOfficialChampionBiographyUrl(entry.source_url);
}
