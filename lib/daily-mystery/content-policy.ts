import type { MysteryContentItem, MysteryTargetType } from "@/lib/daily-mystery/types";
import { localesMatch } from "@/lib/daily-mystery/locale";
import { isOfficialDomain } from "@/lib/daily-mystery/official-source";

/** Location subjects stored as region or place in the existing schema. */
export const DAILY_MYSTERY_LOCATION_TYPES = ["region", "place"] as const;

export const DAILY_MYSTERY_SCHEDULABLE_TYPES = ["champion", ...DAILY_MYSTERY_LOCATION_TYPES] as const;

export type DailyMysterySchedulableType = (typeof DAILY_MYSTERY_SCHEDULABLE_TYPES)[number];

const LOCATION_PAGE_PATTERN =
  /(universe\.)?leagueoflegends\.com\/.*\/(regions?|places?|locations?)\//i;

const CHAMPION_BIOGRAPHY_PATTERN = /ddragon\.leagueoflegends\.com\/.*\/champion\//i;

export function isDailyMysteryLocationType(targetType: MysteryTargetType) {
  return DAILY_MYSTERY_LOCATION_TYPES.includes(targetType as (typeof DAILY_MYSTERY_LOCATION_TYPES)[number]);
}

export function isChampionBiographyContent(item: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "source_text">) {
  if (item.target_type !== "champion") {
    return false;
  }
  if (item.source_type !== "full_biography") {
    return false;
  }
  if (!localesMatch(item.locale, "en_US")) {
    return false;
  }
  if (!item.source_text?.trim()) {
    return false;
  }
  return isOfficialDomain(item.source_url) && CHAMPION_BIOGRAPHY_PATTERN.test(item.source_url);
}

export function isOfficialLocationContent(item: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "source_text">) {
  if (!isDailyMysteryLocationType(item.target_type)) {
    return false;
  }
  if (item.source_type !== "official_page") {
    return false;
  }
  if (!localesMatch(item.locale, "en_US")) {
    return false;
  }
  if (!item.source_text?.trim()) {
    return false;
  }
  return isOfficialDomain(item.source_url) && LOCATION_PAGE_PATTERN.test(item.source_url);
}

export function isDailyMysterySchedulable(
  item: Pick<
    MysteryContentItem,
    "target_type" | "source_type" | "source_url" | "locale" | "source_text" | "review_status" | "retired_at"
  >,
) {
  if (item.review_status !== "approved" || item.retired_at != null) {
    return false;
  }
  if (!localesMatch(item.locale, "en_US")) {
    return false;
  }
  if (!isOfficialDomain(item.source_url)) {
    return false;
  }
  return isChampionBiographyContent(item) || isOfficialLocationContent(item);
}

export function isDailyMysterySeedEntry(
  entry: Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "source_text">,
) {
  return isChampionBiographyContent(entry) || isOfficialLocationContent(entry);
}
