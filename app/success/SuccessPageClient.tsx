"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BookPremiumActions from "@/components/BookPremiumActions";

type BookStatusResponse = {
  status: string;
  accessToken: string;
  canDownloadPdf: boolean;
  characterName: string | null;
  title: string | null;
  error?: string;
};

export default function SuccessPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [statusData, setStatusData] = useState<BookStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing book access token.");
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    async function pollStatus() {
      const currentToken = token;
      if (!currentToken) {
        return;
      }

      try {
        const response = await fetch(`/api/book-status?token=${encodeURIComponent(currentToken)}`);
        const data = (await response.json()) as BookStatusResponse;
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(data.error || "Unable to load book status.");
          return;
        }

        setStatusData(data);
        if (data.status === "ready" || data.status === "failed") {
          if (interval) {
            window.clearInterval(interval);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load book status.");
        }
      }
    }

    void pollStatus();
    interval = window.setInterval(() => {
      void pollStatus();
    }, 4000);

    return () => {
      cancelled = true;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [token]);

  const isReady = statusData?.status === "ready";
  const isFailed = statusData?.status === "failed";

  return (
    <main className="archive-shell flex min-h-screen items-center justify-center px-5 py-10">
      <section className="glass-panel relative z-10 w-full max-w-xl rounded-[2rem] p-8 text-center">
        <p className="font-title text-xs uppercase tracking-[0.36em] text-[#d9bd78]">
          {isReady ? "The chronicle is bound" : "Your legend is being forged"}
        </p>
        <h1 className="font-title mt-4 text-3xl text-[#f7ebce] sm:text-4xl">
          {isReady ? "Your legend is ready" : "The archive is still writing"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#9baabd]">
          {isReady
            ? "Your complete interactive book and PDF download are ready."
            : "You will receive your interactive book and PDF download link by email in a few minutes."}
        </p>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {isFailed ? (
          <p className="mt-4 text-sm text-red-300">
            Something went wrong while binding your book. Please contact support if this persists.
          </p>
        ) : null}

        {token && isReady ? (
          <div className="mt-7 flex flex-col items-center gap-3">
            <Link
              href={`/book/${token}`}
              className="gold-button inline-flex rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
            >
              Open book
            </Link>
            <BookPremiumActions accessToken={token} />
          </div>
        ) : null}

        {!isReady && !isFailed ? (
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#8a9aad]">Status: {statusData?.status || "checking"}</p>
        ) : null}
      </section>
    </main>
  );
}
