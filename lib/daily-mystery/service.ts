import "server-only";

import type { MysteryContentItem, MysteryDailySchedule } from "@/lib/daily-mystery/types";
import { MysteryServiceError, MYSTERY_PUBLIC_UNAVAILABLE } from "@/lib/daily-mystery/errors";
import { buildPublicPuzzleView } from "@/lib/daily-mystery/puzzle";
import {
  ensureDailySchedule,
  getPuzzleNumber,
} from "@/lib/daily-mystery/schedule";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import {
  getContentItemById,
  getContentItemBySlug,
  getOrCreateSession,
  getPlayerStreak,
  getScheduleByPublicId,
} from "@/lib/daily-mystery/store";

export async function resolveDailyPuzzle() {
  const schedule = await ensureDailySchedule();
  const content = await getContentItemById(schedule.content_item_id);
  if (!content || content.review_status !== "approved" || content.retired_at) {
    throw new MysteryServiceError(
      "MYSTERY_SCHEDULE_UNAVAILABLE",
      "Today's Chronicle is unavailable.",
      MYSTERY_PUBLIC_UNAVAILABLE,
    );
  }
  return { schedule, content, mode: "daily" as const };
}

export async function resolveArchivePuzzle(slug: string) {
  const content = await getContentItemBySlug(slug);
  if (!content || content.review_status !== "approved") {
    throw new Error("Archive Chronicle not found.");
  }

  const schedule: MysteryDailySchedule = {
    schedule_date: content.approved_at?.slice(0, 10) || "1970-01-01",
    content_item_id: content.id,
    puzzle_public_id: `archive-${content.slug}`,
    difficulty: content.difficulty,
    admin_override: false,
    locked_at: content.approved_at || content.imported_at,
  };

  return { schedule, content, mode: "archive" as const };
}

export async function resolvePuzzleByPublicId(puzzlePublicId: string) {
  if (puzzlePublicId.startsWith("archive-")) {
    const slug = puzzlePublicId.replace(/^archive-/, "");
    return resolveArchivePuzzle(slug);
  }

  const schedule = await getScheduleByPublicId(puzzlePublicId);
  if (!schedule) {
    throw new Error("Chronicle not found.");
  }

  const content = await getContentItemById(schedule.content_item_id);
  if (!content || content.review_status !== "approved") {
    throw new Error("Chronicle content unavailable.");
  }

  return { schedule, content, mode: "daily" as const };
}

export async function buildPuzzlePayload({
  playerId,
  schedule,
  content,
  mode,
}: {
  playerId: string;
  schedule: MysteryDailySchedule;
  content: MysteryContentItem;
  mode: "daily" | "archive";
}) {
  const session = await getOrCreateSession(playerId, schedule.puzzle_public_id, mode);
  const streak = mode === "daily" ? await getPlayerStreak(playerId) : null;
  const { paragraphTokenIds, publicTokens } = buildPublicPuzzleView(
    content,
    session.revealed_token_ids,
    session.token_proximity,
  );

  const puzzleNumber =
    mode === "daily" ? await getPuzzleNumber(schedule.schedule_date) : null;

  const categoryRevealed = session.hints_used.includes("category");

  return {
    puzzlePublicId: schedule.puzzle_public_id,
    scheduleDate: schedule.schedule_date,
    puzzleNumber,
    difficulty: schedule.difficulty,
    mode,
    tokens: publicTokens,
    paragraphTokenIds,
    session: {
      guessCount: session.guess_count,
      hintsUsed: session.hints_used.length,
      isSolved: session.is_solved,
      startedAt: session.started_at,
      completionTimeMs: session.completion_time_ms,
    },
    streak: streak
      ? {
          current: streak.current_streak,
          longest: streak.longest_streak,
        }
      : null,
    metadata: {
      targetType: categoryRevealed ? content.target_type : null,
      region: session.hints_used.includes("region") ? content.region_tags[0] ?? null : null,
      tutorialCopy:
        content.target_type === "champion"
          ? "Other champion names can be revealed as clues. Only the hidden champion's name will win the game."
          : "Names, places and events may be revealed as clues. Only the hidden subject will win the game.",
    },
    todayDate: getTodayScheduleDate(),
  };
}
