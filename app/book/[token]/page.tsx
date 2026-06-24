"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import ArchiveErrorBoundary from "@/components/ArchiveErrorBoundary";
import InteractiveBook from "@/components/InteractiveBook";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { normalizeBook } from "@/lib/normalizeBook";
import { verifyPayment } from "@/lib/client/api";
import { startPremiumGenerationLoop } from "@/lib/client/premium-generation";
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
  confirmationEmailSent?: boolean;
  confirmationEmailFailed?: boolean;
  recoveryEmailAvailable?: boolean;
  status?: string;
  error?: string;
};

export default function BookAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [book, setBook] = useState<LoreBook | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [isPremium, setIsPremium] = useState(false);
  const [canDownloadPdf, setCanDownloadPdf] = useState(false);
  const [canDownloadMp3, setCanDownloadMp3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [bookIsOpen, setBookIsOpen] = useState(false);
  const [initialPageIndex, setInitialPageIndex] = useState(0);

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
    return data;
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
          setNotice("Payment cancelled. Your free pages are still available.");
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
            const emailNotice = verifyResult.confirmationEmailSent || verifyResult.recoveryEmailAvailable
              ? "Your legend is unlocked. Your private recovery link was also sent by email."
              : verifyResult.confirmationEmailFailed
                ? "Your legend is unlocked. Keep this page link safe to recover your book."
                : "Your legend is unlocked.";
            setNotice(emailNotice);
            setInitialPageIndex(ILLUSTRATED_PAGE_COUNT - 1);
            window.history.replaceState({}, "", `/book/${encodeURIComponent(currentToken)}`);
            console.log("[PAYMENT_VERIFIED_START_PREMIUM_GENERATION]");
            void startPremiumGenerationLoop(currentToken);
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
      {notice ? (
        <div className="pointer-events-none fixed inset-x-0 top-5 z-[90] flex justify-center px-4">
          <p className="rounded-full border border-[#d9bd78]/25 bg-[#120d07]/85 px-5 py-2 text-xs uppercase tracking-[0.18em] text-[#e8dcc0] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {notice}
          </p>
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
