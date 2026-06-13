"use client";

import { motion } from "framer-motion";
import type { BookPage } from "@/lib/types";
import { cn } from "@/lib/utils";

type PagePreviewRitualProps = {
  pages: BookPage[];
  visibleCount: number;
};

function excerpt(text: string, maxWords = 14) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export default function PagePreviewRitual({ pages, visibleCount }: PagePreviewRitualProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pages.slice(0, visibleCount).map((page, index) => (
        <motion.article
          key={page.pageNumber}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.2 }}
          className="ritual-page-card overflow-hidden rounded-xl border border-[#6b4a24]/20"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[#1a1208]">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt={page.title} className="h-full w-full object-cover" />
            ) : (
              <div className="ritual-page-placeholder flex h-full flex-col items-center justify-center p-4 text-center">
                <div className="ritual-shimmer absolute inset-0" aria-hidden="true" />
                <p className="font-title text-[0.55rem] uppercase tracking-[0.26em] text-[#a89068]/70">
                  {page.chapter}
                </p>
                <p className="font-cover-title mt-2 text-sm text-[#d4c4a0]/80">{page.title}</p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/5" />
          </div>
          <div className="ritual-page-text p-3 sm:p-4">
            <p className="font-title text-[0.55rem] uppercase tracking-[0.22em] text-[#6b4a24]/75">
              Page {page.pageNumber}
            </p>
            <p className="font-cover-title mt-1 text-sm leading-snug text-[#2a1a0c]">{page.title}</p>
            <p className={cn("font-manuscript mt-2 text-xs leading-5 text-[#3d2a18]/85")}>
              {excerpt(page.text)}
            </p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
