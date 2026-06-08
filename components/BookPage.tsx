"use client";

import { motion } from "framer-motion";
import type { BookPage as BookPageType } from "@/lib/types";
import { cn } from "@/lib/utils";

type BookPageProps = {
  page: BookPageType;
  isActive: boolean;
};

export default function BookPage({ page, isActive }: BookPageProps) {
  return (
    <article className="page parchment-surface page-shadow relative flex h-full w-full flex-col overflow-hidden p-4 text-[#20170d] sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-35 mix-blend-multiply [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.55),transparent_10rem),repeating-linear-gradient(90deg,rgba(72,45,19,.08)_0_1px,transparent_1px_5px)]" />
      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-[#6b4a24]/25 pb-3">
          <div>
            <p className="font-title text-[0.62rem] uppercase tracking-[0.28em] text-[#6b4a24]/80">Chapter {page.pageNumber}</p>
            <h2 className="font-title mt-1 text-xl leading-tight text-[#24170b] sm:text-2xl">{page.chapter}</h2>
          </div>
          <span className="rounded-full border border-[#6b4a24]/25 bg-[#fff3c5]/35 px-3 py-1 text-xs font-semibold text-[#6b4a24]">
            {String(page.pageNumber).padStart(2, "0")}
          </span>
        </header>

        <div className="grid flex-1 gap-4 md:grid-rows-[minmax(0,1fr)_auto]">
          <div className="relative min-h-56 overflow-hidden rounded-[1.35rem] border border-[#6b4a24]/25 bg-[#32200f] shadow-inner">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt={page.title} className="h-full w-full object-cover" />
            ) : (
              <IllustratedPlaceholder title={page.title} chapter={page.chapter} />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
          </div>

          <motion.div
            key={`${page.pageNumber}-${isActive}`}
            initial={{ opacity: 0, y: 18 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0.72, y: 8 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="rounded-[1.15rem] border border-[#6b4a24]/20 bg-[#fff3c5]/30 p-4 shadow-inner"
          >
            <p className="font-title text-lg leading-tight text-[#2d1b0d]">{page.title}</p>
            <p className="mt-3 text-sm leading-6 text-[#3e2b18] sm:text-[0.95rem]">{page.text}</p>
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

function IllustratedPlaceholder({ title, chapter }: { title: string; chapter: string }) {
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
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[#9fb8d8]/70">Vision obscured by fog</p>
      </div>
    </div>
  );
}
