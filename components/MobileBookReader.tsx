"use client";

import NarratorButton from "@/components/NarratorButton";
import type { BookPage as BookPageType } from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileBookReaderProps = {
  pages: BookPageType[];
  activePageIndex: number;
  loadingImages: Record<number, boolean>;
  imageSealedForPage: (pageNumber: number) => boolean;
  onNarratorClick?: (pageIndex: number) => void;
  isNarratorLoading?: boolean;
  isNarratorPlaying?: boolean;
  narrationPageIndex?: number | null;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export default function MobileBookReader({
  pages,
  activePageIndex,
  loadingImages,
  imageSealedForPage,
  onNarratorClick,
  isNarratorLoading = false,
  isNarratorPlaying = false,
  narrationPageIndex = null,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: MobileBookReaderProps) {
  const page = pages[activePageIndex] || pages[0];
  if (!page) {
    return null;
  }

  const isImageLoading = Boolean(loadingImages[page.pageNumber]);
  const imageSealed = imageSealedForPage(page.pageNumber);
  const narratorActive = narrationPageIndex === activePageIndex;

  return (
    <div className="mobile-book-reader mx-auto flex w-full max-w-md flex-col">
      <article className="mobile-book-page parchment-surface page-shadow overflow-hidden rounded-[1.5rem] border border-[#6b4a24]/15">
        <div className="mobile-book-image-frame relative w-full bg-[#120d07]/40">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.imageUrl}
              alt={page.title}
              className="h-auto max-h-[min(52vh,420px)] w-full object-contain"
            />
          ) : imageSealed ? (
            <div className="flex min-h-[220px] items-center justify-center px-6 py-10 text-center">
              <div>
                <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.28em] text-[#d9bd78]/75">
                  Chapter {page.pageNumber}
                </p>
                <p className="page-elegant-title mt-3 text-xl text-[#f7ebce]">{page.title}</p>
                <p className="mt-4 text-sm leading-7 text-[#c9d3df]/85">The vision beyond this page is sealed.</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center px-6 py-10 text-center">
              <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.22em] text-[#8a9aad]/75">
                {isImageLoading ? "Illustration being summoned..." : "Illustration waiting in the mist"}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#6b4a24]/12 px-5 py-5">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="book-meta-label text-[0.58rem] uppercase tracking-[0.26em] text-[#6b4a24]/70">
                Chapter {page.pageNumber}
              </p>
              <h2 className="page-elegant-title mt-1.5 text-xl leading-tight text-[#2a1a0c]">{page.title}</h2>
            </div>
            {onNarratorClick ? (
              <NarratorButton
                onClick={() => onNarratorClick(activePageIndex)}
                isLoading={isNarratorLoading && narratorActive}
                isPlaying={isNarratorPlaying && narratorActive}
              />
            ) : null}
          </header>

          <div className="mt-4 rounded-xl border border-[#6b4a24]/10 bg-[#fff8e8]/30 p-4">
            <p className="book-body-text text-[0.98rem] leading-[1.65] text-[#352820]">{page.text}</p>
          </div>

          <footer className="book-meta-label mt-4 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-[#6b4a24]/60">
            <span>Personal chronicle</span>
            <span>
              {page.pageNumber} / {pages.length}
            </span>
          </footer>
        </div>
      </article>

      <div
        className={cn(
          "mobile-book-nav sticky bottom-0 z-20 mt-4 flex items-center justify-center gap-3 rounded-[1.25rem]",
          "border border-white/10 bg-[#081225]/80 px-4 py-3 backdrop-blur-md",
        )}
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next page
        </button>
      </div>
    </div>
  );
}
