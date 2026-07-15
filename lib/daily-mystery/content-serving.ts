import type { MysteryContentItem } from "@/lib/daily-mystery/types";
import {
  getSafeSourceHost,
  isDailyMysterySchedulable,
  isOfficialChampionBiographyContent,
} from "@/lib/daily-mystery/content-policy";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";

export function isDailyMysteryContentServable(
  content: Pick<
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
  return isDailyMysterySchedulable(content);
}

export function assertDailyMysteryContentServable(
  content: MysteryContentItem,
  puzzleId: string,
) {
  if (isDailyMysteryContentServable(content)) {
    return;
  }

  console.info("[DAILY_MYSTERY_BLOCKED_INVALID_SOURCE]", {
    puzzleId,
    safeHost: getSafeSourceHost(content.source_url),
  });

  throw new MysteryServiceError(
    "MYSTERY_SCHEDULE_UNAVAILABLE",
    "Today's Chronicle is unavailable.",
    MYSTERY_PUBLIC_UNAVAILABLE,
  );
}

export function getValidatedVictorySource(content: MysteryContentItem) {
  if (!isOfficialChampionBiographyContent(content)) {
    return {
      sourceUrl: "",
      sourceDomain: "",
    };
  }

  return {
    sourceUrl: content.source_url,
    sourceDomain: content.source_domain,
  };
}
