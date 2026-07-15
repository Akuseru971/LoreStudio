import "server-only";

import { createHash } from "crypto";
import type { MysteryContentItem, MysteryTargetType } from "@/lib/daily-mystery/types";
import { CATEGORY_WEIGHTS, MYSTERY_MIN_REPEAT_DAYS } from "@/lib/daily-mystery/types";
import { ensureVerifiedSeedContent } from "@/lib/daily-mystery/bootstrap";
import { collectMysteryDiagnostics, logMysteryDiagnostics } from "@/lib/daily-mystery/diagnostics";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import {
  getScheduleEligibleContentItems,
  getScheduleForDate,
  listRecentScheduleContentIds,
  saveDailySchedule,
} from "@/lib/daily-mystery/store";
import { getZonedDateParts } from "@/lib/daily-mystery/schedule-date";

export { getTodayScheduleDate, getZonedDateParts } from "@/lib/daily-mystery/schedule-date";

function seededUnit(seed: string) {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function pickWeightedCategory(seed: string) {
  const entries = Object.entries(CATEGORY_WEIGHTS) as Array<[MysteryTargetType, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seededUnit(`${seed}:category`) * total;
  for (const [category, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) {
      return category;
    }
  }
  return entries[0]![0];
}

function avoidConsecutiveCategory(
  candidates: MysteryContentItem[],
  recentContentIds: string[],
  preferredCategory: MysteryTargetType,
) {
  if (recentContentIds.length === 0) {
    return candidates;
  }

  const lastId = recentContentIds[recentContentIds.length - 1];
  const lastItem = candidates.find((item) => item.id === lastId);
  if (!lastItem) {
    return candidates;
  }

  const filtered = candidates.filter((item) => item.target_type !== lastItem.target_type);
  if (filtered.length === 0) {
    return candidates;
  }

  const preferred = filtered.filter((item) => item.target_type === preferredCategory);
  return preferred.length > 0 ? preferred : filtered;
}

export async function ensureDailySchedule(date = new Date()) {
  const { scheduleDate } = getZonedDateParts(date);
  const existing = await getScheduleForDate(scheduleDate);
  if (existing) {
    return existing;
  }

  await ensureVerifiedSeedContent();

  const approved = await getScheduleEligibleContentItems();
  if (approved.length === 0) {
    const diagnostics = await collectMysteryDiagnostics();
    logMysteryDiagnostics(diagnostics, "ensureDailySchedule");
    throw new MysteryServiceError(
      "MYSTERY_NO_APPROVED_CONTENT",
      "No approved mystery content is available for scheduling.",
      MYSTERY_PUBLIC_UNAVAILABLE,
    );
  }

  const recent = await listRecentScheduleContentIds(MYSTERY_MIN_REPEAT_DAYS);
  const recentIds = new Set(recent.map((entry) => entry.content_item_id));
  const recentOrderedIds = recent
    .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date))
    .map((entry) => entry.content_item_id);

  const preferredCategory = pickWeightedCategory(scheduleDate);
  let candidates = approved.filter((item) => !recentIds.has(item.id));
  if (candidates.length === 0) {
    candidates = approved;
  }

  candidates = avoidConsecutiveCategory(candidates, recentOrderedIds, preferredCategory);
  const categoryMatches = candidates.filter((item) => item.target_type === preferredCategory);
  const pool = categoryMatches.length > 0 ? categoryMatches : candidates;
  const index = Math.floor(seededUnit(`${scheduleDate}:item`) * pool.length);
  const selected = pool[index]!;

  return saveDailySchedule({
    schedule_date: scheduleDate,
    content_item_id: selected.id,
    difficulty: selected.difficulty,
  });
}

export async function getPuzzleNumber(scheduleDate: string) {
  const { data, error } = await (async () => {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return { data: null, error: new Error("Supabase is not configured.") };
    }
    return supabase
      .from("mystery_daily_schedule")
      .select("schedule_date")
      .lte("schedule_date", scheduleDate)
      .order("schedule_date", { ascending: true });
  })();

  if (error) {
    throw error;
  }

  const rows = data || [];
  const index = rows.findIndex((row) => String(row.schedule_date) === scheduleDate);
  return index >= 0 ? index + 1 : rows.length + 1;
}
