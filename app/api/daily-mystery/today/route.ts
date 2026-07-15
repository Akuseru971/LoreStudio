import { NextResponse } from "next/server";
import { buildPuzzlePayload, resolveDailyPuzzle } from "@/lib/daily-mystery/service";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import { safeTrackServer } from "@/lib/safe-analytics-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOW_TODAY_MS = 1000;

export async function GET() {
  const startedAt = Date.now();
  let scheduleLookupMs = 0;
  let puzzleLoadMs = 0;
  let publicPayloadBuildMs = 0;

  try {
    const playerId = await getOrCreatePlayerId();

    const scheduleStartedAt = Date.now();
    const { schedule, content, mode } = await resolveDailyPuzzle();
    scheduleLookupMs = Date.now() - scheduleStartedAt;

    const payloadStartedAt = Date.now();
    const payload = await buildPuzzlePayload({ playerId, schedule, content, mode });
    publicPayloadBuildMs = Date.now() - payloadStartedAt;
    puzzleLoadMs = scheduleLookupMs + publicPayloadBuildMs;

    safeTrackServer("daily_mystery_viewed", {
      mode,
      puzzleNumber: payload.puzzleNumber ?? null,
      isSolved: payload.session.isSolved,
    });

    if (payload.session.guessCount === 0 && !payload.session.isSolved) {
      safeTrackServer("daily_mystery_started", { mode });
    }

    const totalMs = Date.now() - startedAt;
    console.info("[DAILY_MYSTERY_TODAY_TIMING]", {
      totalMs,
      scheduleLookupMs,
      puzzleLoadMs,
      publicPayloadBuildMs,
    });
    if (totalMs >= SLOW_TODAY_MS) {
      console.warn("[DAILY_MYSTERY_TODAY_SLOW]", { totalMs });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const totalMs = Date.now() - startedAt;
    console.info("[DAILY_MYSTERY_TODAY_TIMING]", {
      totalMs,
      scheduleLookupMs,
      puzzleLoadMs,
      publicPayloadBuildMs,
      failed: true,
    });
    if (totalMs >= SLOW_TODAY_MS) {
      console.warn("[DAILY_MYSTERY_TODAY_SLOW]", { totalMs });
    }

    if (error instanceof MysteryServiceError) {
      return NextResponse.json(
        {
          error: error.publicMessage,
          code: error.code,
          retryable: error.code === "MYSTERY_NO_APPROVED_CONTENT" || error.code === "MYSTERY_SCHEDULE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to load today's Chronicle.";
    const isPreparing = message.includes("Supabase is not configured");
    return NextResponse.json(
      {
        error: isPreparing ? MYSTERY_PUBLIC_UNAVAILABLE : "The Chronicle is temporarily unavailable.",
        code: isPreparing ? "MYSTERY_SUPABASE_NOT_CONFIGURED" : "MYSTERY_SCHEDULE_UNAVAILABLE",
        retryable: isPreparing,
      },
      { status: 503 },
    );
  }
}
