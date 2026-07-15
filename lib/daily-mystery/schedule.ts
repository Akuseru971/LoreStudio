import "server-only";

import { createHash } from "crypto";
import type { MysteryContentItem } from "@/lib/daily-mystery/types";
import { MYSTERY_MIN_REPEAT_DAYS } from "@/lib/daily-mystery/types";
import { isDailyMysterySchedulable } from "@/lib/daily-mystery/content-policy";
import { ensureVerifiedSeedContent } from "@/lib/daily-mystery/bootstrap";
import { collectMysteryDiagnostics, logMysteryDiagnostics } from "@/lib/daily-mystery/diagnostics";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import {
  deleteScheduleForDate,
  getContentItemById,
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

async function ensureValidScheduleForDate(scheduleDate: string) {
  const existing = await getScheduleForDate(scheduleDate);
  if (!existing) {
    return null;
  }

  const content = await getContentItemById(existing.content_item_id);
  if (content && isDailyMysterySchedulable(content)) {
    return existing;
  }

  await deleteScheduleForDate(scheduleDate);
  return null;
}

export async function ensureDailySchedule(date = new Date()) {
  const { scheduleDate } = getZonedDateParts(date);
  const validExisting = await ensureValidScheduleForDate(scheduleDate);
  if (validExisting) {
    return validExisting;
  }

  await ensureVerifiedSeedContent();

  const approved = await getScheduleEligibleContentItems();
  if (approved.length === 0) {
    console.info("[DAILY_MYSTERY_NO_ELIGIBLE_OFFICIAL_BIOGRAPHY]");
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

  let candidates = approved.filter((item) => !recentIds.has(item.id));
  if (candidates.length === 0) {
    candidates = approved;
  }

  const index = Math.floor(seededUnit(`${scheduleDate}:item`) * candidates.length);
  const selected = candidates[index]!;

  return saveDailySchedule({
    schedule_date: scheduleDate,
    content_item_id: selected.id,
    difficulty: selected.difficulty,
  });
}

export async function getPuzzleNumber(scheduleDate: string) {
  const { getSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return 1;
  }

  const { count, error } = await supabase
    .from("mystery_daily_schedule")
    .select("schedule_date", { count: "exact", head: true })
    .lte("schedule_date", scheduleDate);

  if (error) {
    throw error;
  }

  return count && count > 0 ? count : 1;
}
