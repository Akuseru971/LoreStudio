import "server-only";

import {
  classifyDisallowedDailyMysterySource,
  getSafeSourceHost,
  isDailyMysterySchedulable,
  isOfficialChampionBiographyUrl,
} from "@/lib/daily-mystery/content-policy";
import { importOfficialChampionCatalog } from "@/lib/daily-mystery/importer/official-champion-page";
import { clearDailyMysteryPuzzleCache } from "@/lib/daily-mystery/puzzle";
import { ensureDailySchedule } from "@/lib/daily-mystery/schedule";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import {
  deleteScheduleForDate,
  getContentItemById,
  getScheduleForDate,
} from "@/lib/daily-mystery/store";
import type { MysteryContentItem } from "@/lib/daily-mystery/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type DailyMysteryOfficialSourceAuditReport = {
  total: number;
  validOfficialChampionBios: number;
  ddragonRecords: number;
  universeRecords: number;
  invalidHostRecords: number;
  invalidUrlPatternRecords: number;
  nonEnglishRecords: number;
  nonChampionRecords: number;
  invalidApprovedRecords: number;
  invalidScheduledPuzzles: number;
  todaySourceValid: boolean;
};

function mapContentRow(row: Record<string, unknown>): MysteryContentItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    locale: String(row.locale ?? "en_US"),
    target_type: row.target_type as MysteryContentItem["target_type"],
    canonical_title: String(row.canonical_title),
    protected_terms: (row.protected_terms as string[]) ?? [],
    accepted_solution_aliases: (row.accepted_solution_aliases as string[]) ?? [],
    source_text: String(row.source_text),
    source_url: String(row.source_url),
    source_domain: String(row.source_domain),
    source_type: row.source_type as MysteryContentItem["source_type"],
    source_hash: String(row.source_hash),
    riot_content_version: row.riot_content_version ? String(row.riot_content_version) : null,
    ddragon_version: row.ddragon_version ? String(row.ddragon_version) : null,
    difficulty: Number(row.difficulty ?? 3),
    region_tags: (row.region_tags as string[]) ?? [],
    related_champion_ids: (row.related_champion_ids as string[]) ?? [],
    hint_metadata: (row.hint_metadata as MysteryContentItem["hint_metadata"]) ?? {},
    review_status: row.review_status as MysteryContentItem["review_status"],
    imported_at: String(row.imported_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    retired_at: row.retired_at ? String(row.retired_at) : null,
  };
}

function classifyAuditBuckets(item: MysteryContentItem) {
  if (isDailyMysterySchedulable(item)) {
    return "valid" as const;
  }

  const classification = classifyDisallowedDailyMysterySource(item);
  if (classification === "ddragon") {
    return "ddragon" as const;
  }
  if (classification === "universe") {
    return "universe" as const;
  }
  if (classification === "non_english") {
    return "non_english" as const;
  }
  if (classification === "non_champion") {
    return "non_champion" as const;
  }

  try {
    const host = getSafeSourceHost(item.source_url);
    if (host !== "www.leagueoflegends.com") {
      return "invalid_host" as const;
    }
  } catch {
    return "invalid_host" as const;
  }

  if (!isOfficialChampionBiographyUrl(item.source_url)) {
    return "invalid_url_pattern" as const;
  }

  return "invalid" as const;
}

export async function auditDailyMysteryOfficialSources(): Promise<DailyMysteryOfficialSourceAuditReport> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.from("mystery_content_items").select("*");
  if (error) {
    throw new Error(error.message);
  }

  const report: DailyMysteryOfficialSourceAuditReport = {
    total: data?.length ?? 0,
    validOfficialChampionBios: 0,
    ddragonRecords: 0,
    universeRecords: 0,
    invalidHostRecords: 0,
    invalidUrlPatternRecords: 0,
    nonEnglishRecords: 0,
    nonChampionRecords: 0,
    invalidApprovedRecords: 0,
    invalidScheduledPuzzles: 0,
    todaySourceValid: false,
  };

  const items = (data ?? []).map((row) => mapContentRow(row));
  for (const item of items) {
    const bucket = classifyAuditBuckets(item);
    if (bucket === "valid") {
      report.validOfficialChampionBios += 1;
    } else if (bucket === "ddragon") {
      report.ddragonRecords += 1;
    } else if (bucket === "universe") {
      report.universeRecords += 1;
    } else if (bucket === "invalid_host") {
      report.invalidHostRecords += 1;
    } else if (bucket === "invalid_url_pattern") {
      report.invalidUrlPatternRecords += 1;
    } else if (bucket === "non_english") {
      report.nonEnglishRecords += 1;
    } else if (bucket === "non_champion") {
      report.nonChampionRecords += 1;
    }

    if (item.review_status === "approved" && bucket !== "valid") {
      report.invalidApprovedRecords += 1;
    }
  }

  const { data: schedules, error: scheduleError } = await supabase
    .from("mystery_daily_schedule")
    .select("schedule_date, content_item_id, puzzle_public_id");
  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  const contentById = new Map(items.map((item) => [item.id, item]));
  for (const schedule of schedules ?? []) {
    const content = contentById.get(String(schedule.content_item_id));
    if (!content || !isDailyMysterySchedulable(content)) {
      report.invalidScheduledPuzzles += 1;
    }
  }

  const today = getTodayScheduleDate();
  const todaySchedule = await getScheduleForDate(today);
  if (todaySchedule) {
    const todayContent = await getContentItemById(todaySchedule.content_item_id);
    report.todaySourceValid = Boolean(todayContent && isDailyMysterySchedulable(todayContent));
  }

  console.info("[DAILY_MYSTERY_SOURCE_AUDIT]", {
    total: report.total,
    validOfficialChampionBios: report.validOfficialChampionBios,
    ddragonRecords: report.ddragonRecords,
    universeRecords: report.universeRecords,
    invalidRecords:
      report.invalidHostRecords +
      report.invalidUrlPatternRecords +
      report.nonEnglishRecords +
      report.nonChampionRecords +
      report.ddragonRecords +
      report.universeRecords,
    invalidApprovedRecords: report.invalidApprovedRecords,
    invalidScheduledPuzzles: report.invalidScheduledPuzzles,
    todaySourceValid: report.todaySourceValid,
  });

  return report;
}

export async function cleanDailyMysteryOfficialSources() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const audit = await auditDailyMysteryOfficialSources();
  const { data, error } = await supabase
    .from("mystery_content_items")
    .select("id, target_type, source_type, source_url, locale, source_text, source_hash, review_status, hint_metadata");
  if (error) {
    throw new Error(error.message);
  }

  const now = new Date().toISOString();
  let disabled = 0;

  for (const row of data ?? []) {
    const item = mapContentRow(row);
    if (isDailyMysterySchedulable(item)) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("mystery_content_items")
      .update({
        review_status: "retired",
        retired_at: now,
        approved_at: null,
        hint_metadata: {
          ...item.hint_metadata,
          daily_mystery_ineligible: true,
        },
        updated_at: now,
      })
      .eq("id", item.id);

    if (!updateError) {
      disabled += 1;
      console.info("[DAILY_MYSTERY_INVALID_SOURCE_DISABLED]", {
        contentId: item.id,
        sourceType: item.source_type,
        safeHost: getSafeSourceHost(item.source_url),
      });
    }
  }

  return { audit, disabled };
}

export async function removeInvalidDailyMysterySchedules() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("mystery_daily_schedule")
    .select("schedule_date, content_item_id, puzzle_public_id");
  if (error) {
    throw new Error(error.message);
  }

  let removed = 0;
  for (const row of data ?? []) {
    const content = await getContentItemById(String(row.content_item_id));
    if (content && isDailyMysterySchedulable(content)) {
      continue;
    }

    const scheduleDate = String(row.schedule_date);
    await deleteScheduleForDate(scheduleDate);
    removed += 1;
    console.info("[DAILY_MYSTERY_INVALID_SCHEDULE_REMOVED]", {
      scheduleId: String(row.puzzle_public_id),
      scheduledDate: scheduleDate,
      safeSourceHost: content ? getSafeSourceHost(content.source_url) : "missing_content",
    });
  }

  return { removed };
}

export async function importOfficialChampionBiographies({
  limit,
}: {
  limit?: number;
} = {}) {
  return importOfficialChampionCatalog({
    limit,
    autoApprove: true,
  });
}

export async function rescheduleInvalidTodayOfficialPuzzle({
  forceReplaceInvalidToday = false,
}: {
  forceReplaceInvalidToday?: boolean;
} = {}) {
  const today = getTodayScheduleDate();
  const existing = await getScheduleForDate(today);

  if (existing) {
    const content = await getContentItemById(existing.content_item_id);
    if (content && isDailyMysterySchedulable(content) && !forceReplaceInvalidToday) {
      return { rescheduled: false, schedule: existing };
    }

    await deleteScheduleForDate(today);
    if (content && !isDailyMysterySchedulable(content)) {
      console.info("[DAILY_MYSTERY_INVALID_SCHEDULE_REMOVED]", {
        scheduleId: existing.puzzle_public_id,
        scheduledDate: today,
        safeSourceHost: getSafeSourceHost(content.source_url),
      });
    }
  }

  const schedule = await ensureDailySchedule();
  const content = await getContentItemById(schedule.content_item_id);
  console.info("[DAILY_MYSTERY_TODAY_RESCHEDULED_OFFICIAL]", {
    scheduledDate: schedule.schedule_date,
    contentId: schedule.content_item_id,
    sourceHost: content ? getSafeSourceHost(content.source_url) : "unknown",
  });

  return { rescheduled: true, schedule };
}

export function clearDailyMysteryStaleCaches() {
  clearDailyMysteryPuzzleCache();
}

export async function verifyDailyMysteryProductionSource() {
  const today = getTodayScheduleDate();
  const schedule = await getScheduleForDate(today);
  if (!schedule) {
    return { valid: false, reason: "no_schedule" as const };
  }

  const content = await getContentItemById(schedule.content_item_id);
  if (!content || !isDailyMysterySchedulable(content)) {
    return { valid: false, reason: "invalid_content" as const };
  }

  const verification = {
    sourceHost: getSafeSourceHost(content.source_url),
    sourceType: content.source_type,
    language: "en",
    valid: true as const,
  };

  console.info("[DAILY_MYSTERY_PRODUCTION_SOURCE_VERIFIED]", verification);
  return verification;
}

export async function refreshDailyMysteryOfficialSources({
  limit,
  forceReplaceInvalidToday = false,
}: {
  limit?: number;
  forceReplaceInvalidToday?: boolean;
} = {}) {
  const steps = {
    audit: await auditDailyMysteryOfficialSources(),
    cleaned: await cleanDailyMysteryOfficialSources(),
    schedulesRemoved: await removeInvalidDailyMysterySchedules(),
    imported: await importOfficialChampionBiographies({ limit }),
    rescheduled: await rescheduleInvalidTodayOfficialPuzzle({ forceReplaceInvalidToday }),
    verification: await verifyDailyMysteryProductionSource(),
  };

  clearDailyMysteryStaleCaches();
  return steps;
}
