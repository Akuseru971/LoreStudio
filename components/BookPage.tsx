"use client";

import { motion } from "framer-motion";
import type { BookPage as BookPageType } from "@/lib/types";
import { cn } from "@/lib/utils";

type BookPageProps = {
  page: BookPageType;
  isActive: boolean;
  side?: "image" | "text";
  isImageLoading?: boolean;
  isTextRevealed?: boolean;
};

export default function BookPage({
  page,
  isActive,
  side = "text",
  isImageLoading = false,
  isTextRevealed = true,
}: BookPageProps) {
  if (side === "image") {
    return <ImageLeaf page={page} isImageLoading={isImageLoading} />;
  }

  return (
    <article className="page parchment-surface page-shadow relative flex h-full w-full flex-col overflow-hidden p-5 text-[#20170d] sm:p-7">
      <div className="pointer-events-none absolute inset-0 opacity-35 mix-blend-multiply [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.55),transparent_10rem),repeating-linear-gradient(90deg,rgba(72,45,19,.08)_0_1px,transparent_1px_5px)]" />
      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-5 flex items-center justify-between gap-3 border-b border-[#6b4a24]/25 pb-4">
          <div>
            <p className="font-title text-[0.62rem] uppercase tracking-[0.28em] text-[#6b4a24]/80">Chapter {page.pageNumber}</p>
            <h2 className="font-title mt-2 text-2xl leading-tight text-[#24170b] sm:text-3xl">{page.chapter}</h2>
          </div>
          <span className="rounded-full border border-[#6b4a24]/25 bg-[#fff3c5]/35 px-3 py-1 text-xs font-semibold text-[#6b4a24]">
            {String(page.pageNumber).padStart(2, "0")}
          </span>
        </header>

        <div className="flex flex-1 items-center">
          <motion.div
            key={`${page.pageNumber}-${isActive}-${isTextRevealed}`}
            initial={{ opacity: 0, y: 18 }}
            animate={isActive && isTextRevealed ? { opacity: 1, y: 0 } : { opacity: 0.72, y: 8 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="w-full rounded-[1.4rem] border border-[#6b4a24]/20 bg-[#fff3c5]/30 p-5 shadow-inner sm:p-7"
          >
            <p className="font-title text-2xl leading-tight text-[#2d1b0d] sm:text-3xl">{page.title}</p>
            {isTextRevealed ? (
              <p className="mt-5 text-base leading-8 text-[#3e2b18]">{page.text}</p>
            ) : (
              <p className="mt-5 text-sm italic leading-7 text-[#6b4a24]/75">
                The narrator draws breath. The ink waits for the voice.
              </p>
            )}
          </motion.div>
        </div>

        <footer className="mt-3 flex items-center justify-between border-t border-[#6b4a24]/20 pt-3 text-[0.65rem] uppercase tracking-[0.22em] text-[#6b4a24]/70">
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
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.55),transparent_10rem),repeating-linear-gradient(90deg,rgba(72,45,19,.08)_0_1px,transparent_1px_5px)]" />
      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-3 flex items-center justify-between border-b border-[#6b4a24]/20 pb-3">
          <p className="font-title text-[0.62rem] uppercase tracking-[0.28em] text-[#6b4a24]/80">Illustration</p>
          <p className="font-title text-[0.62rem] uppercase tracking-[0.28em] text-[#6b4a24]/80">
            {String(page.pageNumber).padStart(2, "0")} / 8
          </p>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-[#6b4a24]/25 bg-[#32200f] shadow-inner">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.imageUrl} alt={page.title} className="h-full w-full object-cover" />
          ) : (
            <IllustratedPlaceholder title={page.title} chapter={page.chapter} isImageLoading={isImageLoading} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
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
        "bg-[radial-gradient(circle_at_35%_22%,rgba(217,189,120,.35),transparent_10rem),linear-gradient(135deg,#21150f,#09111e_55%,#03050a)]",
      )}
    >
      <div>
        <p className="font-title text-xs uppercase tracking-[0.32em] text-[#d9bd78]/80">{chapter}</p>
        <p className="font-title mt-4 text-2xl leading-tight text-[#f4e2b5]">{title}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[#9fb8d8]/70">
          {isImageLoading ? "Illustration being painted..." : "Illustration waiting in the mist"}
        </p>
      </div>
    </div>
  );
}
