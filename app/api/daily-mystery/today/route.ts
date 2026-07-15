import { NextResponse } from "next/server";
import { buildPuzzlePayload, resolveDailyPuzzle } from "@/lib/daily-mystery/service";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import { safeTrackServer } from "@/lib/safe-analytics-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const playerId = await getOrCreatePlayerId();
    const { schedule, content, mode } = await resolveDailyPuzzle();
    const payload = await buildPuzzlePayload({ playerId, schedule, content, mode });

    safeTrackServer("daily_mystery_viewed", {
      mode,
      puzzleNumber: payload.puzzleNumber ?? null,
      isSolved: payload.session.isSolved,
    });

    if (payload.session.guessCount === 0 && !payload.session.isSolved) {
      safeTrackServer("daily_mystery_started", { mode });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof MysteryServiceError) {
      return NextResponse.json(
        {
          error: error.publicMessage,
          code: error.code,
          retryable: error.code === "MYSTERY_NO_APPROVED_CONTENT",
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
