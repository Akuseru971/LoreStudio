import { NextResponse } from "next/server";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { resolvePuzzleByPublicId } from "@/lib/daily-mystery/service";
import { getOrCreateSession, getPlayerStreak } from "@/lib/daily-mystery/store";
import { getPuzzleNumber } from "@/lib/daily-mystery/schedule";
import { buildProximitySharePattern, buildShareResult } from "@/lib/daily-mystery/streak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const playerId = await getOrCreatePlayerId();
    const puzzlePublicId = new URL(request.url).searchParams.get("puzzlePublicId")?.trim();
    if (!puzzlePublicId) {
      return NextResponse.json({ error: "Missing puzzle id." }, { status: 400 });
    }

    const { schedule, content, mode } = await resolvePuzzleByPublicId(puzzlePublicId);
    const session = await getOrCreateSession(playerId, puzzlePublicId, mode);
    if (!session.is_solved) {
      return NextResponse.json({ error: "Chronicle not yet solved." }, { status: 403 });
    }

    const streak = mode === "daily" ? await getPlayerStreak(playerId) : null;
    const puzzleNumber = mode === "daily" ? await getPuzzleNumber(schedule.schedule_date) : null;
    const sharePattern = buildProximitySharePattern([
      {
        revealedCount: session.revealed_token_ids.length > 0 ? 1 : 0,
        hadProximity: Object.keys(session.token_proximity).length > 0,
        solved: true,
      },
    ]);

    return NextResponse.json({
      canonicalTitle: content.canonical_title,
      targetType: content.target_type,
      sourceText: content.source_text,
      sourceUrl: content.source_url,
      sourceDomain: content.source_domain,
      difficulty: content.difficulty,
      guessCount: session.guess_count,
      completionTimeMs: session.completion_time_ms,
      hintsUsed: session.hints_used.length,
      streak: streak?.current_streak ?? 0,
      relatedChampionIds: content.related_champion_ids,
      regionTags: content.region_tags,
      shareText: buildShareResult({
        puzzleNumber: puzzleNumber ?? 0,
        guessCount: session.guess_count,
        hintsUsed: session.hints_used.length,
        streak: streak?.current_streak ?? 0,
        proximityPattern: sharePattern,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load result.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
