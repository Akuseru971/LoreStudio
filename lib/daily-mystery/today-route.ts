import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isDailyMysteryContentServable } from "@/lib/daily-mystery/content-serving";
import { getSafeSourceHost } from "@/lib/daily-mystery/content-policy";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import { clearDailyMysteryPuzzleCache } from "@/lib/daily-mystery/puzzle";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import { logSupabaseSchemaError } from "@/lib/daily-mystery/supabase-diagnostics";
import { rescheduleInvalidTodayOfficialPuzzle } from "@/lib/daily-mystery/source-refresh";
import { getContentItemById, getScheduleForDate } from "@/lib/daily-mystery/store";
import type { MysteryContentItem, MysteryDailySchedule } from "@/lib/daily-mystery/types";

export type TodayRouteStage =
  | "initialization"
  | "environment_validation"
  | "supabase_client_init"
  | "date_resolution"
  | "player_identification"
  | "schedule_lookup"
  | "puzzle_load"
  | "source_validation"
  | "public_payload_build";

export type DailyMysteryDatabaseConfig = {
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
};

export function getDailyMysteryDatabaseConfig(): DailyMysteryDatabaseConfig {
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { hasSupabaseUrl, hasServiceRoleKey };
}

export function logDailyMysteryDatabaseConfig(config: DailyMysteryDatabaseConfig) {
  console.info("[DAILY_MYSTERY_DATABASE_CONFIG]", config);
}

export function assertDailyMysteryDatabaseConfig(config: DailyMysteryDatabaseConfig) {
  if (config.hasSupabaseUrl && config.hasServiceRoleKey) {
    return;
  }

  logDailyMysteryDatabaseConfig(config);
  throw new MysteryServiceError(
    "MYSTERY_SUPABASE_NOT_CONFIGURED",
    "Daily Mystery database configuration is missing.",
    "Today's chronicle could not be loaded.",
  );
}

export function logTodayFailed(
  stage: TodayRouteStage,
  error: unknown,
  config: DailyMysteryDatabaseConfig,
) {
  logSupabaseSchemaError(error, "daily_mystery_today");

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode =
    error instanceof MysteryServiceError
      ? error.code
      : error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
  const safeMessage =
    error instanceof MysteryServiceError
      ? error.code
      : error instanceof Error
        ? error.message.slice(0, 200)
        : "unknown_error";

  console.info("[DAILY_MYSTERY_TODAY_FAILED]", {
    stage,
    errorName,
    errorCode: errorCode ?? null,
    safeMessage,
    hasSupabaseUrl: config.hasSupabaseUrl,
    hasServiceRoleKey: config.hasServiceRoleKey,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  });
}

function logScheduleFound(schedule: MysteryDailySchedule, contentEligible: boolean) {
  console.info("[DAILY_MYSTERY_SCHEDULE_FOUND]", {
    scheduleId: schedule.puzzle_public_id,
    scheduledDate: schedule.schedule_date,
    hasContent: true,
    contentEligible,
  });
}

function logScheduleInvalidReference(schedule: MysteryDailySchedule | null, hasContent: boolean) {
  console.info("[DAILY_MYSTERY_SCHEDULE_INVALID_REFERENCE]", {
    scheduleId: schedule?.puzzle_public_id ?? null,
    hasContent,
  });
}

async function loadScheduleAndContent(scheduleDate: string) {
  const schedule = await getScheduleForDate(scheduleDate);
  if (!schedule) {
    logScheduleInvalidReference(null, false);
    return null;
  }

  const content = await getContentItemById(schedule.content_item_id);
  if (!content) {
    logScheduleInvalidReference(schedule, false);
    return null;
  }

  const contentEligible = isDailyMysteryContentServable(content);
  if (!contentEligible) {
    console.info("[DAILY_MYSTERY_BLOCKED_INVALID_SOURCE]", {
      puzzleId: schedule.puzzle_public_id,
      safeHost: getSafeSourceHost(content.source_url),
    });
    logScheduleInvalidReference(schedule, true);
    return null;
  }

  logScheduleFound(schedule, true);
  return { schedule, content, mode: "daily" as const };
}

async function recoverTodaySchedule() {
  clearDailyMysteryPuzzleCache();
  await rescheduleInvalidTodayOfficialPuzzle({ forceReplaceInvalidToday: true });
}

export async function resolveTodayScheduleAndContent() {
  const scheduleDate = getTodayScheduleDate();
  const resolved = await loadScheduleAndContent(scheduleDate);
  if (resolved) {
    return resolved;
  }

  try {
    await recoverTodaySchedule();
  } catch (recoveryError) {
    logSupabaseSchemaError(recoveryError, "mystery_daily_schedule");
    throw recoveryError;
  }

  const recovered = await loadScheduleAndContent(scheduleDate);
  if (!recovered) {
    throw new MysteryServiceError(
      "MYSTERY_SCHEDULE_UNAVAILABLE",
      "No valid official Daily Mystery schedule exists for today.",
      MYSTERY_PUBLIC_UNAVAILABLE,
    );
  }

  return recovered;
}

export function assertSupabaseClientReady() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new MysteryServiceError(
      "MYSTERY_SUPABASE_NOT_CONFIGURED",
      "Supabase client could not be initialized.",
      "Today's chronicle could not be loaded.",
    );
  }
  return client;
}

export function isNoValidDailyMysteryError(error: unknown) {
  return (
    error instanceof MysteryServiceError &&
    (error.code === "MYSTERY_SCHEDULE_UNAVAILABLE" || error.code === "MYSTERY_NO_APPROVED_CONTENT")
  );
}

export function isDatabaseConfigError(error: unknown) {
  return error instanceof MysteryServiceError && error.code === "MYSTERY_SUPABASE_NOT_CONFIGURED";
}

export type TodayResolvedPuzzle = {
  schedule: MysteryDailySchedule;
  content: MysteryContentItem;
  mode: "daily";
};
