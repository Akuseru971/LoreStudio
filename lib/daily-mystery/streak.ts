import type { MysteryPlayerStreak } from "@/lib/daily-mystery/types";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";

export function calculateStreakAfterCompletion(
  streak: MysteryPlayerStreak,
  completedScheduleDate: string,
): MysteryPlayerStreak {
  const today = getTodayScheduleDate();
  if (completedScheduleDate !== today) {
    return streak;
  }

  if (!streak.last_completed_date) {
    return {
      ...streak,
      current_streak: 1,
      longest_streak: Math.max(1, streak.longest_streak),
      last_completed_date: completedScheduleDate,
    };
  }

  const last = new Date(`${streak.last_completed_date}T00:00:00Z`);
  const current = new Date(`${completedScheduleDate}T00:00:00Z`);
  const diffDays = Math.round((current.getTime() - last.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return streak;
  }

  const nextStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
  return {
    ...streak,
    current_streak: nextStreak,
    longest_streak: Math.max(streak.longest_streak, nextStreak),
    last_completed_date: completedScheduleDate,
  };
}

export function buildShareResult({
  puzzleNumber,
  guessCount,
  hintsUsed,
  streak,
  proximityPattern,
}: {
  puzzleNumber: number;
  guessCount: number;
  hintsUsed: number;
  streak: number;
  proximityPattern: string;
}) {
  return [
    `THE HIDDEN CHRONICLE #${puzzleNumber}`,
    "",
    `Solved in ${guessCount} guesses`,
    `Hints used: ${hintsUsed}`,
    `Streak: ${streak} days`,
    "",
    proximityPattern,
  ].join("\n");
}

export function buildProximitySharePattern(
  guesses: Array<{ revealedCount: number; hadProximity: boolean; solved: boolean }>,
) {
  return guesses
    .slice(-5)
    .map((guess) => {
      if (guess.solved) {
        return "🟩";
      }
      if (guess.revealedCount > 0) {
        return "🟨";
      }
      if (guess.hadProximity) {
        return "🟧";
      }
      return "⬛";
    })
    .join(" ");
}
