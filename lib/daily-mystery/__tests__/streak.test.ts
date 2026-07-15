import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { calculateStreakAfterCompletion } from "@/lib/daily-mystery/streak";
import { buildShareResult, buildProximitySharePattern } from "@/lib/daily-mystery/streak";
import { hintPenalty } from "@/lib/daily-mystery/hints";

describe("calculateStreakAfterCompletion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a streak on first completion", () => {
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
    const next = calculateStreakAfterCompletion(
      { player_id: "p1", current_streak: 0, longest_streak: 0, last_completed_date: null },
      "2026-06-09",
    );
    expect(next.current_streak).toBe(1);
    expect(next.longest_streak).toBe(1);
  });

  it("increments streak on consecutive days", () => {
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    const next = calculateStreakAfterCompletion(
      { player_id: "p1", current_streak: 3, longest_streak: 5, last_completed_date: "2026-06-09" },
      "2026-06-10",
    );
    expect(next.current_streak).toBe(4);
    expect(next.longest_streak).toBe(5);
  });

  it("resets streak after a missed day", () => {
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
    const next = calculateStreakAfterCompletion(
      { player_id: "p1", current_streak: 4, longest_streak: 4, last_completed_date: "2026-06-09" },
      "2026-06-11",
    );
    expect(next.current_streak).toBe(1);
  });
});

describe("share result", () => {
  it("never includes the answer", () => {
    const text = buildShareResult({
      puzzleNumber: 42,
      guessCount: 27,
      hintsUsed: 1,
      streak: 8,
      proximityPattern: "⬛ 🟨 🟨 🟩 🟩",
    });
    expect(text).toContain("THE HIDDEN CHRONICLE #42");
    expect(text).not.toMatch(/irelia/i);
    expect(text).toContain("Solved in 27 guesses");
  });

  it("builds proximity pattern without leaking words", () => {
    const pattern = buildProximitySharePattern([
      { revealedCount: 0, hadProximity: false, solved: false },
      { revealedCount: 1, hadProximity: false, solved: false },
      { revealedCount: 0, hadProximity: true, solved: false },
      { revealedCount: 2, hadProximity: false, solved: false },
      { revealedCount: 0, hadProximity: false, solved: true },
    ]);
    expect(pattern).toBe("⬛ 🟨 🟧 🟨 🟩");
  });
});

describe("hintPenalty", () => {
  it("counts each hint as a penalty unit", () => {
    expect(hintPenalty(["category", "region"])).toBe(2);
  });
});
