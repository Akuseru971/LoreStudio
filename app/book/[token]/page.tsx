"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import ArchiveErrorBoundary from "@/components/ArchiveErrorBoundary";
import InteractiveBook from "@/components/InteractiveBook";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { fetchBookStatus, verifyPayment } from "@/lib/client/api";
import { normalizeBook } from "@/lib/normalizeBook";
import type { LoreBook } from "@/lib/types";

type BookResponse = {
  status: string;
  accessToken: string;
  book: LoreBook | null;
  isPremium?: boolean;
  canDownloadPdf?: boolean;
  canDownloadMp3?: boolean;
  error?: string;
};

type VerifyPaymentResponse = {
  verified?: boolean;
  isPremium?: boolean;
  canDownloadPdf?: boolean;
  canDownloadMp3?: boolean;
  readyIllustrationCount?: number;
  allIllustrationsReady?: boolean;
  status?: string;
  error?: string;
};

type BookStatusResponse = {
  status?: string;
  isPremium?: boolean;
  canDownloadPdf?: boolean;
  canDownloadMp3?: boolean;
  readyIllustrationCount?: number;
  allIllustrationsReady?: boolean;
  confirmationEmailStatus?: string;
  confirmationEmailSentAt?: string | null;
  confirmationEmailFailed?: boolean;
  error?: string;
};

type UnlockNotice = {
  title: string;
  message: string;
  readyCount?: number;
  variant: "preparing" | "ready" | "recovery";
};

const STATUS_POLL_INTERVAL_MS = 4000;
const PREPARING_STATUSES = new Set(["paid", "preparing_assets", "generating"]);

function buildPreparingNotice(readyCount?: number): UnlockNotice {
  return {
    title: "Your legend has been unlocked",
    message:
      "The seal has broken. Your complete legend is unlocked. The final illustrations are being summoned, and you will receive an email when your finished book is ready.",
    readyCount,
    variant: "preparing",
  };
}

function buildReadyNotice(emailSent: boolean): UnlockNotice {
  if (emailSent) {
    return {
      title: "Your complete legend is ready",
      message:
        "Your final book is available now. We also sent your recovery link by email.",
      variant: "ready",
    };
  }

  return {
    title: "Your complete legend is ready",
    message: "Your final book is available now.",
    variant: "ready",
  };
}

function buildRecoveryNotice(): UnlockNotice {
  return {
    title: "Your legend has been unlocked",
    message: "Keep this page link safe to recover your book.",
    variant: "recovery",
  };
}

export default function BookAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [book, setBook] = useState<LoreBook | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [isPremium, setIsPremium] = useState(false);
  const [canDownloadPdf, setCanDownloadPdf] = useState(false);
  const [canDownloadMp3, setCanDownloadMp3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockNotice, setUnlockNotice] = useState<UnlockNotice | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [bookIsOpen, setBookIsOpen] = useState(false);
  const [initialPageIndex, setInitialPageIndex] = useState(0);
  const [shouldPollStatus, setShouldPollStatus] = useState(false);

  const statusPollRef = useRef(0);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    void params.then((resolved) => setToken(resolved.token));
  }, [params]);

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  const loadBook = useCallback(async (currentToken: string) => {
    const response = await fetch(`/api/book?token=${encodeURIComponent(currentToken)}`);
    const data = (await response.json()) as BookResponse;

    if (!response.ok) {
      throw new Error(data.error || "This book could not be found.");
    }

    if (data.status === "generating" && !data.book) {
      setBook(null);
      setStatus("generating");
      setIsPremium(Boolean(data.isPremium));
      setCanDownloadPdf(Boolean(data.canDownloadPdf));
      setCanDownloadMp3(Boolean(data.canDownloadMp3));
      return data;
    }

    if (!data.book) {
      throw new Error(data.error || "This legend could not be found.");
    }

    const normalizedBook = normalizeBook(data.book);
    if (!normalizedBook) {
      throw new Error("This legend could not be read. Some archive fields may still be preparing.");
    }

    setBook(normalizedBook);
    setStatus(data.status || "free");
    setIsPremium(Boolean(data.isPremium));
    setCanDownloadPdf(Boolean(data.canDownloadPdf));
    setCanDownloadMp3(Boolean(data.canDownloadMp3));

    const isPreparing =
      Boolean(data.isPremium) &&
      (PREPARING_STATUSES.has(data.status || "") || !data.canDownloadPdf);
    setShouldPollStatus(isPreparing);

    return data;
  }, []);

  const refreshUnlockNotice = useCallback((bookStatus: BookStatusResponse) => {
    const readyCount = bookStatus.readyIllustrationCount ?? 0;
    const emailSent = Boolean(
      bookStatus.confirmationEmailSentAt || bookStatus.confirmationEmailStatus === "sent",
    );

    if (bookStatus.allIllustrationsReady || bookStatus.status === "ready") {
      setUnlockNotice(buildReadyNotice(emailSent));
      return;
    }

    if (bookStatus.confirmationEmailFailed) {
      setUnlockNotice(buildRecoveryNotice());
      return;
    }

    if (bookStatus.isPremium) {
      setUnlockNotice(buildPreparingNotice(readyCount));
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function initializeBook() {
      const currentToken = token;
      if (!currentToken) {
        return;
      }

      const query = new URLSearchParams(window.location.search);
      const paymentState = query.get("payment");
      const sessionId = query.get("session_id");

      try {
        if (paymentState === "cancelled") {
          setUnlockNotice({
            title: "Payment cancelled",
            message: "Your free pages are still available.",
            variant: "recovery",
          });
          setInitialPageIndex(ILLUSTRATED_PAGE_COUNT - 1);
          window.history.replaceState({}, "", `/book/${encodeURIComponent(currentToken)}`);
        }

        if (paymentState === "success" && sessionId) {
          setIsVerifyingPayment(true);
          const { response: verifyResponse, data: verifyData } = await verifyPayment({
            accessToken: currentToken,
            sessionId,
          });

          const verifyResult = verifyData as VerifyPaymentResponse;

          if (!verifyResponse.ok || !verifyResult.verified) {
            throw new Error(verifyResult.error || "Payment could not be verified.");
          }

          if (!cancelled) {
            setUnlockNotice(buildPreparingNotice(verifyResult.readyIllustrationCount));
            setShouldPollStatus(true);
            setInitialPageIndex(ILLUSTRATED_PAGE_COUNT - 1);
            window.history.replaceState({}, "", `/book/${encodeURIComponent(currentToken)}`);
          }
        }

        if (!cancelled) {
          await loadBook(currentToken);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("[BOOK_PAGE_LOAD_ERROR]", loadError);
          setError(loadError instanceof Error ? loadError.message : "This book could not be loaded.");
          setStatus("error");
        }
      } finally {
        if (!cancelled) {
          setIsVerifyingPayment(false);
        }
      }
    }

    void initializeBook();
    return () => {
      cancelled = true;
    };
  }, [loadBook, token]);

  useEffect(() => {
    if (!token || !shouldPollStatus) {
      return;
    }

    statusPollRef.current += 1;
    const pollId = statusPollRef.current;
    let cancelled = false;

    async function pollStatus() {
      try {
        const { response, data } = await fetchBookStatus(token!);
        const bookStatus = data as BookStatusResponse;

        if (cancelled || statusPollRef.current !== pollId || !response.ok) {
          return;
        }

        setIsPremium(Boolean(bookStatus.isPremium));
        setCanDownloadPdf(Boolean(bookStatus.canDownloadPdf));
        setCanDownloadMp3(Boolean(bookStatus.canDownloadMp3));
        setStatus(bookStatus.status || status);
        refreshUnlockNotice(bookStatus);

        const shouldContinuePolling =
          bookStatus.status === "failed"
            ? false
            : !bookStatus.allIllustrationsReady &&
              (PREPARING_STATUSES.has(bookStatus.status || "") || Boolean(bookStatus.isPremium));

        if (!shouldContinuePolling) {
          setShouldPollStatus(false);
          if (pollIntervalRef.current !== null) {
            window.clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (pollError) {
        console.error("[BOOK_STATUS_POLL_ERROR]", pollError);
      }
    }

    void pollStatus();
    pollIntervalRef.current = window.setInterval(() => {
      void pollStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      statusPollRef.current += 1;
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [refreshUnlockNotice, shouldPollStatus, status, token]);

  const shouldPlayAmbientMusic = Boolean(book) && bookIsOpen && !ambientMuted;

  if (status === "loading" || isVerifyingPayment) {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <p className="text-sm uppercase tracking-[0.22em] text-[#9baabd]">
          {isVerifyingPayment ? "Opening the final pages..." : "Loading your legend…"}
        </p>
      </main>
    );
  }

  if (status === "generating") {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-2xl text-[#f7ebce]">Your legend is still being written…</h1>
          <p className="mt-4 text-sm leading-7 text-[#9baabd]">
            Some assets are still being prepared. Reload this page in a moment to continue reading.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="gold-button mt-6 rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
          >
            Reload
          </button>
        </section>
      </main>
    );
  }

  if (status === "error" || !book || !token) {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-3xl text-[#f7ebce]">This legend could not be found.</h1>
          <p className="mt-4 text-sm leading-7 text-[#9baabd]">{error}</p>
          <Link
            href="/"
            className="gold-button mt-6 inline-flex rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
          >
            Return home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <AmbientMusicPlayer shouldPlay={shouldPlayAmbientMusic} normalVolume={0.12} />
      <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
      {unlockNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-5 z-[90] flex justify-center px-4">
          <section className="max-w-2xl rounded-[1.5rem] border border-[#d9bd78]/25 bg-[#120d07]/90 px-5 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <h2 className="font-title text-base text-[#f7ebce] sm:text-lg">{unlockNotice.title}</h2>
            <p className="mt-2 text-xs leading-6 text-[#d9c7a0] sm:text-sm">{unlockNotice.message}</p>
            {unlockNotice.variant === "preparing" && typeof unlockNotice.readyCount === "number" ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#d9bd78]/90">
                Illustrations ready: {unlockNotice.readyCount}/{FULL_BOOK_PAGE_COUNT}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
      <ArchiveErrorBoundary
        onReset={() => {
          window.location.href = "/";
        }}
        resetLabel="Return home"
      >
        <InteractiveBook
          book={book}
          accessToken={token}
          isPremium={isPremium}
          canDownloadPdf={canDownloadPdf}
          canDownloadMp3={canDownloadMp3}
          initialPageIndex={initialPageIndex}
          onReadingStateChange={setBookIsOpen}
          onReset={() => {
            window.location.href = "/";
          }}
        />
      </ArchiveErrorBoundary>
    </>
  );
}
