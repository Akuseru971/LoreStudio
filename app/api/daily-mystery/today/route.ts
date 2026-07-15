import { NextResponse } from "next/server";
import { buildPuzzlePayload, resolveDailyPuzzle } from "@/lib/daily-mystery/service";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
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
    const message = error instanceof Error ? error.message : "Unable to load today's Chronicle.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
