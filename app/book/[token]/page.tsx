"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import AmbientMusicToggle from "@/components/AmbientMusicToggle";
import InteractiveBook from "@/components/InteractiveBook";
import {
  readAmbientMusicMutedPreference,
  writeAmbientMusicMutedPreference,
} from "@/lib/ambient-music-config";
import type { LoreBook } from "@/lib/types";

type BookResponse = {
  status: string;
  accessToken: string;
  book: LoreBook | null;
  canDownloadPdf: boolean;
  error?: string;
};

export default function BookAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [book, setBook] = useState<LoreBook | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [canDownloadPdf, setCanDownloadPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambientMuted, setAmbientMuted] = useState(() => readAmbientMusicMutedPreference());
  const [bookIsOpen, setBookIsOpen] = useState(false);

  useEffect(() => {
    void params.then((resolved) => setToken(resolved.token));
  }, [params]);

  useEffect(() => {
    writeAmbientMusicMutedPreference(ambientMuted);
  }, [ambientMuted]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadBook() {
      const currentToken = token;
      if (!currentToken) {
        return;
      }

      try {
        const response = await fetch(`/api/book?token=${encodeURIComponent(currentToken)}`);
        const data = (await response.json()) as BookResponse;
        if (cancelled) {
          return;
        }

        if (!response.ok || !data.book) {
          setError(data.error || "This book could not be found.");
          setStatus("error");
          return;
        }

        setBook(data.book);
        setStatus(data.status);
        setCanDownloadPdf(Boolean(data.canDownloadPdf));
      } catch {
        if (!cancelled) {
          setError("This book could not be loaded.");
          setStatus("error");
        }
      }
    }

    void loadBook();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const shouldPlayAmbientMusic = status === "ready" && bookIsOpen && !ambientMuted;

  if (status === "loading") {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <p className="text-sm uppercase tracking-[0.22em] text-[#9baabd]">Opening your chronicle...</p>
      </main>
    );
  }

  if (status === "error" || !book || !token) {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-3xl text-[#f7ebce]">The tome could not be opened</h1>
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

  if (status !== "ready") {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-3xl text-[#f7ebce]">Your legend is still being forged</h1>
          <p className="mt-4 text-sm leading-7 text-[#9baabd]">
            The archive is still preparing your complete book. Check your email, or return here in a few minutes.
          </p>
          <Link
            href={`/success?token=${encodeURIComponent(token)}`}
            className="gold-button mt-6 inline-flex rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
          >
            View status
          </Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <AmbientMusicPlayer shouldPlay={shouldPlayAmbientMusic} normalVolume={0.12} />
      <AmbientMusicToggle muted={ambientMuted} onToggle={() => setAmbientMuted((current) => !current)} />
      <InteractiveBook
        book={book}
        accessToken={token}
        isPremium
        canDownloadPdf={canDownloadPdf}
        onReadingStateChange={setBookIsOpen}
        onReset={() => {
          window.location.href = "/";
        }}
      />
    </>
  );
}
