"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import ChronicleBoard from "@/components/daily-mystery/ChronicleBoard";
import type { MysteryPublicToken } from "@/lib/daily-mystery/types";
import { safeTrackClient } from "@/lib/safe-analytics-client";

type PuzzlePayload = {
  puzzlePublicId: string;
  scheduleDate: string;
  puzzleNumber: number | null;
  difficulty: number;
  mode: "daily" | "archive";
  tokens: MysteryPublicToken[];
  paragraphTokenIds: string[][];
  session: {
    guessCount: number;
    hintsUsed: number;
    isSolved: boolean;
    startedAt: string;
    completionTimeMs: number | null;
  };
  streak: { current: number; longest: number } | null;
  metadata: {
    targetType: string | null;
    region: string | null;
    tutorialCopy: string;
  };
};

type ResultPayload = {
  canonicalTitle: string;
  targetType: string;
  sourceText: string;
  sourceUrl: string;
  sourceDomain: string;
  difficulty: number;
  guessCount: number;
  completionTimeMs: number | null;
  hintsUsed: number;
  streak: number;
  regionTags: string[];
  shareText: string;
};

type DailyMysteryGameProps = {
  initialMode?: "daily" | "archive";
  archiveSlug?: string;
};

export default function DailyMysteryGame({ initialMode = "daily", archiveSlug }: DailyMysteryGameProps) {
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [puzzle, setPuzzle] = useState<PuzzlePayload | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newlyRevealedIds, setNewlyRevealedIds] = useState<string[]>([]);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResult = useCallback(async (puzzlePublicId: string) => {
    const response = await fetch(`/api/daily-mystery/result?puzzlePublicId=${encodeURIComponent(puzzlePublicId)}`);
    const data = await response.json();
    if (response.ok) {
      setResult(data);
    }
  }, []);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response =
        initialMode === "archive" && archiveSlug
          ? await fetch("/api/daily-mystery/archive/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: archiveSlug }),
            })
          : await fetch("/api/daily-mystery/today");

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load Chronicle.");
      }

      setPuzzle(data);
      if (data.session.isSolved) {
        await loadResult(data.puzzlePublicId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Chronicle.");
    } finally {
      setLoading(false);
    }
  }, [archiveSlug, initialMode, loadResult]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError(null);
      try {
        const response =
          initialMode === "archive" && archiveSlug
            ? await fetch("/api/daily-mystery/archive/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: archiveSlug }),
              })
            : await fetch("/api/daily-mystery/today");

        const data = await response.json();
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || "Unable to load Chronicle.");
        }

        setPuzzle(data);
        if (data.session.isSolved) {
          const resultResponse = await fetch(
            `/api/daily-mystery/result?puzzlePublicId=${encodeURIComponent(data.puzzlePublicId)}`,
          );
          const resultData = await resultResponse.json();
          if (!cancelled && resultResponse.ok) {
            setResult(resultData);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load Chronicle.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [archiveSlug, initialMode]);

  const submitGuess = useCallback(async () => {
    if (!puzzle || !guess.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setNewlyRevealedIds([]);

    try {
      const response = await fetch("/api/daily-mystery/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzlePublicId: puzzle.puzzlePublicId,
          guess: guess.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Guess failed.");
      }

      setPuzzle((current) =>
        current
          ? {
              ...current,
              tokens: data.tokens,
              paragraphTokenIds: data.paragraphTokenIds,
              session: {
                ...current.session,
                guessCount: data.guessCount,
                isSolved: data.isSolved,
                completionTimeMs: data.completionTimeMs,
              },
            }
          : current,
      );

      setNewlyRevealedIds(data.revealedTokenIds ?? []);
      setFeedback(data.feedback);
      setGuess("");

      if (data.isSolved) {
        await loadResult(puzzle.puzzlePublicId);
      }
    } catch (submitError) {
      setFeedback(submitError instanceof Error ? submitError.message : "Guess failed.");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [guess, loadResult, puzzle, submitting]);

  const requestHint = useCallback(async () => {
    if (!puzzle || puzzle.session.isSolved) {
      return;
    }

    const response = await fetch("/api/daily-mystery/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzlePublicId: puzzle.puzzlePublicId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setHintMessage(data.error || "No hint available.");
      return;
    }

    setHintMessage(typeof data.message === "string" ? data.message : "A hint has been revealed.");
    setPuzzle((current) =>
      current
        ? {
            ...current,
            tokens: data.tokens,
            paragraphTokenIds: data.paragraphTokenIds,
            session: {
              ...current.session,
              hintsUsed: data.hintsUsed,
            },
            metadata: {
              ...current.metadata,
              targetType: data.hintType === "category" ? current.metadata.targetType ?? "revealed" : current.metadata.targetType,
            },
          }
        : current,
    );
    if (data.revealedTokenIds?.length) {
      setNewlyRevealedIds(data.revealedTokenIds);
    }
  }, [puzzle]);

  const copyShare = useCallback(async () => {
    if (!result?.shareText) {
      return;
    }
    safeTrackClient("mystery_share_clicked", { mode: puzzle?.mode ?? "daily" });
    try {
      if (navigator.share) {
        await navigator.share({ text: result.shareText });
        return;
      }
      await navigator.clipboard.writeText(result.shareText);
      setFeedback("Result copied to clipboard.");
    } catch {
      setFeedback("Unable to share result.");
    }
  }, [puzzle?.mode, result]);

  if (loading) {
    return <div className="daily-mystery-shell daily-mystery-loading">Summoning today&apos;s Chronicle...</div>;
  }

  if (error || !puzzle) {
    return (
      <div className="daily-mystery-shell daily-mystery-error">
        <p>{error || "Chronicle unavailable."}</p>
        <button type="button" className="gold-button mt-4 rounded-2xl px-5 py-3" onClick={() => void loadPuzzle()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="daily-mystery-shell">
      <motion.section
        className="daily-mystery-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">Daily Mystery</p>
        <h1 className="font-cover-title mt-2 text-3xl text-[#f7ebce] sm:text-4xl">The Hidden Chronicle</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[#9baabd]">
          {puzzle.puzzleNumber ? <span>#{puzzle.puzzleNumber}</span> : null}
          <span>{puzzle.scheduleDate}</span>
          <span>Difficulty {puzzle.difficulty}</span>
          {puzzle.streak ? <span>Streak {puzzle.streak.current} days</span> : null}
          <span>{puzzle.session.guessCount} guesses</span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8c2d0]">{puzzle.metadata.tutorialCopy}</p>
      </motion.section>

      <div className="daily-mystery-grid">
        <section className="glass-panel daily-mystery-panel">
          <ChronicleBoard
            tokens={puzzle.tokens}
            paragraphTokenIds={puzzle.paragraphTokenIds}
            newlyRevealedIds={newlyRevealedIds}
          />
        </section>

        <aside className="daily-mystery-sidebar">
          {!puzzle.session.isSolved ? (
            <div className="daily-mystery-input-wrap glass-panel">
              <label htmlFor="mystery-guess" className="sr-only">
                Enter a word or guess the answer
              </label>
              <input
                ref={inputRef}
                id="mystery-guess"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitGuess();
                  }
                }}
                placeholder="Enter a word or guess the answer"
                className="daily-mystery-input"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={submitting}
              />
              <button
                type="button"
                className="gold-button daily-mystery-submit"
                onClick={() => void submitGuess()}
                disabled={submitting || !guess.trim()}
              >
                {submitting ? "Searching..." : "Reveal"}
              </button>
              <div aria-live="polite" className="daily-mystery-feedback">
                {feedback}
                {hintMessage ? <p className="mt-2 text-[#d9bd78]">{hintMessage}</p> : null}
              </div>
              <button type="button" className="daily-mystery-hint-button" onClick={() => void requestHint()}>
                Request hint ({puzzle.session.hintsUsed} used)
              </button>
            </div>
          ) : null}

          <AnimatePresence>
            {result ? (
              <motion.div
                className="glass-panel daily-mystery-victory"
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">Solved</p>
                <h2 className="font-cover-title mt-2 text-2xl text-[#f7ebce]">{result.canonicalTitle}</h2>
                <p className="mt-3 text-sm capitalize text-[#9baabd]">{result.targetType.replace(/_/g, " ")}</p>
                <p className="mt-4 text-sm leading-7 text-[#d9c599]">{result.sourceText}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#9baabd]">
                  Official source:{" "}
                  <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="text-[#d9bd78] underline">
                    {result.sourceDomain}
                  </a>
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#b8c2d0]">
                  <div>Guesses: {result.guessCount}</div>
                  <div>Hints: {result.hintsUsed}</div>
                  <div>Time: {result.completionTimeMs ? Math.round(result.completionTimeMs / 1000) : 0}s</div>
                  <div>Streak: {result.streak}</div>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <button type="button" className="gold-button rounded-2xl px-5 py-3" onClick={() => void copyShare()}>
                    Share result
                  </button>
                  <Link href="/daily-mystery/archive" className="daily-mystery-secondary-link">
                    Explore the Chronicle Archive
                  </Link>
                  <Link href="/" className="daily-mystery-secondary-link" onClick={() => safeTrackClient("create_legend_clicked_from_mystery", { source: "victory" })}>
                    Create Your Legend
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </aside>
      </div>

      <p className="daily-mystery-legal">
        Lore Studio is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone
        officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are
        trademarks or registered trademarks of Riot Games, Inc.
      </p>
    </div>
  );
}
