import { NextResponse } from "next/server";
import { buildPuzzlePayload } from "@/lib/daily-mystery/service";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { MysteryServiceError } from "@/lib/daily-mystery/errors";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import { safeTrackServer } from "@/lib/safe-analytics-server";
import {
  assertDailyMysteryDatabaseConfig,
  assertSupabaseClientReady,
  getDailyMysteryDatabaseConfig,
  isDatabaseConfigError,
  isNoValidDailyMysteryError,
  logDailyMysteryDatabaseConfig,
  logTodayFailed,
  resolveTodayScheduleAndContent,
  type TodayRouteStage,
} from "@/lib/daily-mystery/today-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOW_TODAY_MS = 1000;

type TodayTiming = {
  totalMs: number;
  scheduleLookupMs: number;
  puzzleLoadMs: number;
  publicPayloadBuildMs: number;
  failed?: boolean;
  failedStage?: TodayRouteStage;
};

function logTodayTiming(timing: TodayTiming) {
  console.info("[DAILY_MYSTERY_TODAY_TIMING]", timing);
  if (timing.totalMs >= SLOW_TODAY_MS) {
    console.warn("[DAILY_MYSTERY_TODAY_SLOW]", { totalMs: timing.totalMs, failedStage: timing.failedStage ?? null });
  }
}

function databaseConfigResponse() {
  return NextResponse.json(
    {
      status: "error",
      code: "DAILY_MYSTERY_DATABASE_CONFIG_MISSING",
      message: "Today's chronicle could not be loaded.",
      error: "Today's chronicle could not be loaded.",
      retryable: true,
    },
    { status: 500 },
  );
}

function loadFailedResponse(message = "We could not summon today's chronicle.") {
  return NextResponse.json(
    {
      status: "error",
      code: "DAILY_MYSTERY_LOAD_FAILED",
      message,
      error: message,
      retryable: true,
    },
    { status: 500 },
  );
}

function noValidPuzzleResponse(message = "Today's chronicle is not available yet.") {
  return NextResponse.json(
    {
      status: "empty",
      code: "NO_VALID_DAILY_MYSTERY",
      message,
      error: message,
      retryable: true,
    },
    { status: 503 },
  );
}

export async function GET() {
  const startedAt = performance.now();
  let stage: TodayRouteStage = "initialization";
  let scheduleLookupMs = 0;
  let puzzleLoadMs = 0;
  let publicPayloadBuildMs = 0;
  const databaseConfig = getDailyMysteryDatabaseConfig();

  try {
    stage = "environment_validation";
    assertDailyMysteryDatabaseConfig(databaseConfig);
    logDailyMysteryDatabaseConfig(databaseConfig);

    stage = "supabase_client_init";
    assertSupabaseClientReady();

    stage = "date_resolution";
    getTodayScheduleDate();

    stage = "player_identification";
    const playerId = await getOrCreatePlayerId();

    stage = "schedule_lookup";
    const scheduleStart = performance.now();
    let schedule;
    let content;
    let mode: "daily";
    try {
      ({ schedule, content, mode } = await resolveTodayScheduleAndContent());
    } finally {
      scheduleLookupMs = performance.now() - scheduleStart;
    }

    stage = "puzzle_load";
    stage = "public_payload_build";
    const payloadStart = performance.now();
    const payload = await buildPuzzlePayload({ playerId, schedule, content, mode });
    publicPayloadBuildMs = performance.now() - payloadStart;
    puzzleLoadMs = scheduleLookupMs + publicPayloadBuildMs;

    safeTrackServer("daily_mystery_viewed", {
      mode,
      puzzleNumber: payload.puzzleNumber ?? null,
      isSolved: payload.session.isSolved,
    });

    if (payload.session.guessCount === 0 && !payload.session.isSolved) {
      safeTrackServer("daily_mystery_started", { mode });
    }

    logTodayTiming({
      totalMs: Math.round(performance.now() - startedAt),
      scheduleLookupMs: Math.round(scheduleLookupMs),
      puzzleLoadMs: Math.round(puzzleLoadMs),
      publicPayloadBuildMs: Math.round(publicPayloadBuildMs),
    });

    return NextResponse.json(payload);
  } catch (error) {
    logTodayFailed(stage, error, databaseConfig);
    logTodayTiming({
      totalMs: Math.round(performance.now() - startedAt),
      scheduleLookupMs: Math.round(scheduleLookupMs),
      puzzleLoadMs: Math.round(puzzleLoadMs),
      publicPayloadBuildMs: Math.round(publicPayloadBuildMs),
      failed: true,
      failedStage: stage,
    });

    if (isDatabaseConfigError(error)) {
      return databaseConfigResponse();
    }

    if (isNoValidDailyMysteryError(error)) {
      return noValidPuzzleResponse(
        error instanceof MysteryServiceError ? error.publicMessage : "Today's chronicle is not available yet.",
      );
    }

    if (error instanceof MysteryServiceError) {
      return loadFailedResponse(error.publicMessage);
    }

    const message = error instanceof Error ? error.message : "Unable to load today's Chronicle.";
    if (message.includes("Supabase is not configured")) {
      return databaseConfigResponse();
    }

    return loadFailedResponse();
  }
}
