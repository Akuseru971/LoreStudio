import { NextResponse } from "next/server";
import { evaluateGuess, mergeProximity } from "@/lib/daily-mystery/match";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { checkGuessRateLimit } from "@/lib/daily-mystery/rate-limit";
import { buildPublicPuzzleView, buildPuzzleFromContent } from "@/lib/daily-mystery/puzzle";
import { resolvePuzzleByPublicId } from "@/lib/daily-mystery/service";
import { computeSemanticProximity } from "@/lib/daily-mystery/semantic";
import type { MysteryProximityLevel } from "@/lib/daily-mystery/types";
import {
  getOrCreateSession,
  getPlayerStreak,
  savePlayerStreak,
  updateSession,
} from "@/lib/daily-mystery/store";
import { calculateStreakAfterCompletion } from "@/lib/daily-mystery/streak";
import { MYSTERY_MAX_GUESSES_PER_MINUTE } from "@/lib/daily-mystery/types";
import { safeTrackServer } from "@/lib/safe-analytics-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEMANTIC_TIMEOUT_MS = 250;

type GuessBody = {
  puzzlePublicId?: string;
  guess?: string;
};

function highestProximityLevel(updates: Record<string, MysteryProximityLevel>) {
  const rank = { close: 1, warm: 2, very_close: 3 } as const;
  let best: MysteryProximityLevel = null;
  for (const level of Object.values(updates)) {
    if (!level) {
      continue;
    }
    if (!best || rank[level] > rank[best]) {
      best = level;
    }
  }
  return best ?? "none";
}

async function computeSemanticProximityWithTimeout(
  params: Parameters<typeof computeSemanticProximity>[0],
) {
  try {
    return await Promise.race([
      computeSemanticProximity(params),
      new Promise<Record<string, MysteryProximityLevel>>((resolve) => {
        setTimeout(() => resolve({}), SEMANTIC_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const playerId = await getOrCreatePlayerId();
    if (!checkGuessRateLimit(playerId, MYSTERY_MAX_GUESSES_PER_MINUTE)) {
      return NextResponse.json({ error: "Too many guesses. Please wait a moment." }, { status: 429 });
    }

    const body = (await request.json()) as GuessBody;
    const guess = body.guess?.trim();
    const puzzlePublicId = body.puzzlePublicId?.trim();

    if (!guess || !puzzlePublicId) {
      return NextResponse.json({ error: "Missing guess or puzzle id." }, { status: 400 });
    }

    const { schedule, content, mode } = await resolvePuzzleByPublicId(puzzlePublicId);
    const session = await getOrCreateSession(playerId, puzzlePublicId, mode);
    if (session.is_solved) {
      return NextResponse.json({
        status: "won",
        isCorrectAnswer: true,
        isSolved: true,
        feedback: "This Chronicle has already been solved.",
      });
    }

    const { tokens } = buildPuzzleFromContent(content);
    const revealed = new Set(session.revealed_token_ids);
    const result = evaluateGuess({
      guess,
      tokens,
      canonicalTitle: content.canonical_title,
      acceptedAliases: content.accepted_solution_aliases,
      protectedTerms: content.protected_terms,
      alreadyRevealed: revealed,
      currentProximity: session.token_proximity,
    });

    let proximityUpdates = result.proximityUpdates;
    if (result.isAbsent && !result.isCorrect) {
      const semanticUpdates = await computeSemanticProximityWithTimeout({
        contentItemId: content.id,
        guessLemma: guess.toLowerCase(),
        tokens,
        revealed,
      });
      proximityUpdates = mergeProximity(session.token_proximity, semanticUpdates);
      if (Object.keys(semanticUpdates).length > 0) {
        safeTrackServer("mystery_semantic_match", { mode });
      }
    }

    for (const tokenId of result.revealedTokenIds) {
      revealed.add(tokenId);
    }

    const nextGuessCount = session.guess_count + 1;
    const isVictory = result.isCorrect;
    const completedAt = isVictory ? new Date().toISOString() : session.completed_at;
    const completionTimeMs = isVictory
      ? Date.now() - new Date(session.started_at).getTime()
      : session.completion_time_ms;

    const updated = await updateSession(session.id, {
      ...session,
      revealed_token_ids: [...revealed],
      token_proximity: proximityUpdates,
      guess_count: nextGuessCount,
      is_solved: isVictory,
      completed_at: completedAt,
      completion_time_ms: completionTimeMs,
    });

    const processingMs = Date.now() - startedAt;
    const semanticLevel = highestProximityLevel(proximityUpdates);

    console.info("[DAILY_MYSTERY_GUESS_PROCESSED]", {
      puzzleId: puzzlePublicId,
      normalizedGuessLength: guess.trim().length,
      exactAnswerMatch: isVictory,
      revealedCount: result.revealedTokenIds.length,
      semanticLevel,
      gameStatus: isVictory ? "won" : "playing",
      processingMs,
    });

    if (isVictory) {
      console.info("[DAILY_MYSTERY_VICTORY_CONFIRMED]", {
        puzzleId: puzzlePublicId,
        guessCount: nextGuessCount,
        processingMs,
      });
    }

    safeTrackServer("mystery_guess_submitted", {
      mode,
      isCorrect: isVictory,
      revealedCount: result.revealedTokenIds.length,
      guessCount: nextGuessCount,
    });

    if (result.revealedTokenIds.length > 0) {
      safeTrackServer("mystery_word_revealed", {
        mode,
        revealedCount: result.revealedTokenIds.length,
      });
    }

    if (isVictory) {
      safeTrackServer("mystery_solved", {
        mode,
        guessCount: nextGuessCount,
        hintsUsed: updated.hints_used.length,
      });

      if (mode === "daily") {
        const streak = await getPlayerStreak(playerId);
        const nextStreak = calculateStreakAfterCompletion(streak, schedule.schedule_date);
        await savePlayerStreak(nextStreak);
      }
    }

    const { publicTokens, paragraphTokenIds } = buildPublicPuzzleView(
      content,
      updated.revealed_token_ids,
      updated.token_proximity,
    );

    return NextResponse.json({
      status: isVictory ? "won" : "playing",
      isCorrectAnswer: isVictory,
      isCorrect: isVictory,
      isAbsent: result.isAbsent,
      feedback: result.feedback,
      revealedTokenIds: result.revealedTokenIds,
      revealedTexts: result.revealedTokenIds.reduce<Record<string, string>>((acc, tokenId) => {
        if (result.revealedTexts[tokenId]) {
          acc[tokenId] = result.revealedTexts[tokenId]!;
        }
        return acc;
      }, {}),
      proximityUpdates,
      semanticProximity: semanticLevel,
      guessCount: updated.guess_count,
      isSolved: updated.is_solved,
      tokens: publicTokens,
      paragraphTokenIds,
      completionTimeMs: updated.completion_time_ms,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process guess.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
