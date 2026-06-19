"use client";

import { motion } from "framer-motion";
import SyncedNarrationText from "@/components/SyncedNarrationText";
import type { BookPage as BookPageType } from "@/lib/types";
import { cn } from "@/lib/utils";

type BookPageProps = {
  page: BookPageType;
  isActive: boolean;
  side?: "image" | "text";
  isImageLoading?: boolean;
};

export default function BookPage({ page, isActive, side = "text", isImageLoading = false }: BookPageProps) {
  if (side === "image") {
    return <ImageLeaf page={page} isImageLoading={isImageLoading} />;
  }

  return (
    <article className="page parchment-surface page-shadow relative flex h-full w-full flex-col overflow-hidden p-5 text-[#20170d] sm:p-7">
      <div className="page-spine-crease" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.45),transparent_10rem),repeating-linear-gradient(90deg,rgba(72,45,19,.06)_0_1px,transparent_1px_5px)]" />
      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-[#6b4a24]/20 pb-3">
          <div>
            <p className="book-meta-label text-[0.58rem] uppercase tracking-[0.26em] text-[#6b4a24]/70">
              Chapter {page.pageNumber}
            </p>
            <h2 className="page-elegant-title mt-1.5 text-xl leading-tight text-[#2a1a0c] sm:text-2xl">{page.chapter}</h2>
          </div>
          <span className="rounded-full border border-[#6b4a24]/18 bg-[#fff8e8]/40 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-wider text-[#6b4a24]/75">
            {String(page.pageNumber).padStart(2, "0")}
          </span>
        </header>

        <div className="flex flex-1 items-center">
          <motion.div
            key={page.pageNumber}
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full rounded-lg border border-[#6b4a24]/12 bg-[#fff8e8]/25 p-5 shadow-[inset_0_2px_12px_rgba(80,52,28,0.06)] sm:p-6"
          >
            <p className="page-elegant-title text-xl leading-snug sm:text-2xl">{page.title}</p>
            <SyncedNarrationText text={page.text} isActive={isActive} />
          </motion.div>
        </div>

        <footer className="book-meta-label mt-3 flex items-center justify-between border-t border-[#6b4a24]/15 pt-2.5 text-[0.6rem] uppercase tracking-[0.2em] text-[#6b4a24]/60">
          <span>Personal chronicle</span>
          <span>{page.pageNumber} / 8</span>
        </footer>
      </div>
    </article>
  );
}

function ImageLeaf({ page, isImageLoading }: { page: BookPageType; isImageLoading: boolean }) {
  return (
    <article className="page parchment-surface page-shadow relative flex h-full w-full flex-col overflow-hidden p-4 text-[#20170d] sm:p-5">
      <div className="page-spine-crease" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-28 mix-blend-multiply [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.45),transparent_10rem),repeating-linear-gradient(90deg,rgba(72,45,19,.06)_0_1px,transparent_1px_5px)]" />
      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-3 flex items-center justify-between border-b border-[#6b4a24]/15 pb-2.5">
          <p className="book-meta-label text-[0.58rem] uppercase tracking-[0.26em] text-[#6b4a24]/70">Illustration</p>
          <p className="book-meta-label text-[0.58rem] uppercase tracking-[0.26em] text-[#6b4a24]/70">
            {String(page.pageNumber).padStart(2, "0")} / 8
          </p>
        </header>

        <div className="manuscript-frame relative min-h-0 flex-1">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.imageUrl} alt={page.title} className="relative z-0 h-full w-full object-cover" />
          ) : (
            <IllustratedPlaceholder title={page.title} chapter={page.chapter} isImageLoading={isImageLoading} />
          )}
          <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/25 via-transparent to-white/8" />
        </div>
      </div>
    </article>
  );
}

function IllustratedPlaceholder({
  title,
  chapter,
  isImageLoading,
}: {
  title: string;
  chapter: string;
  isImageLoading: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-56 w-full items-center justify-center p-6 text-center",
        "bg-[radial-gradient(circle_at_35%_22%,rgba(180,155,110,.25),transparent_10rem),linear-gradient(135deg,#21150f,#09111e_55%,#03050a)]",
      )}
    >
      <div>
        <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.28em] text-[#a89068]/75">{chapter}</p>
        <p className="page-elegant-title mt-3 text-xl leading-tight text-[#e8dcc0] sm:text-2xl">{title}</p>
        <p className="mt-4 text-[0.62rem] uppercase tracking-[0.22em] text-[#8a9aad]/70">
          {isImageLoading ? "Illustration being painted..." : "Illustration waiting in the mist"}
        </p>
      </div>
    </div>
  );
}
