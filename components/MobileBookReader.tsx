"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import NarratorButton from "@/components/NarratorButton";
import { resetMobileBookScroll, scheduleMobileBookScrollReset } from "@/lib/mobile-book-scroll";
import type { BookPage as BookPageType } from "@/lib/types";

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
  scrollFooter?: ReactNode;
};

const PAGE_CHANGE_LOCK_MS = 250;

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
  scrollFooter,
}: MobileBookReaderProps) {
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const pageChangeTimerRef = useRef<number | null>(null);
  const [isPageChanging, setIsPageChanging] = useState(false);

  const page = pages[activePageIndex] || pages[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    scheduleMobileBookScrollReset(mobileScrollRef.current);
  }, [activePageIndex]);

  useEffect(() => {
    return () => {
      if (pageChangeTimerRef.current !== null) {
        window.clearTimeout(pageChangeTimerRef.current);
      }
    };
  }, []);

  const runPageChange = useCallback(
    (action: () => void) => {
      if (isPageChanging) {
        return;
      }

      setIsPageChanging(true);
      resetMobileBookScroll(mobileScrollRef.current);
      action();

      if (pageChangeTimerRef.current !== null) {
        window.clearTimeout(pageChangeTimerRef.current);
      }

      pageChangeTimerRef.current = window.setTimeout(() => {
        setIsPageChanging(false);
        pageChangeTimerRef.current = null;
      }, PAGE_CHANGE_LOCK_MS);
    },
    [isPageChanging],
  );

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious || isPageChanging) {
      return;
    }

    runPageChange(onPrevious);
  }, [canGoPrevious, isPageChanging, onPrevious, runPageChange]);

  const handleNext = useCallback(() => {
    if (!canGoNext || isPageChanging) {
      return;
    }

    runPageChange(onNext);
  }, [canGoNext, isPageChanging, onNext, runPageChange]);

  if (!page) {
    return null;
  }

  const isImageLoading = Boolean(loadingImages[page.pageNumber]);
  const imageSealed = imageSealedForPage(page.pageNumber);
  const narratorActive = narrationPageIndex === activePageIndex;
  const navDisabled = isPageChanging;

  return (
    <div className="mobile-book-shell mx-auto flex w-full max-w-md flex-col">
      <div ref={mobileScrollRef} className="mobile-book-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <article className="mobile-chapter-page">
          <div className="mobile-chapter-image-frame">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt={page.title} className="mobile-chapter-image" />
            ) : imageSealed ? (
              <div className="mobile-chapter-image-placeholder">
                <div>
                  <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.28em] text-[#d9bd78]/75">
                    Chapter {page.pageNumber}
                  </p>
                  <p className="page-elegant-title mt-2 text-lg text-[#f7ebce]">{page.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[#c9d3df]/85">The vision beyond this page is sealed.</p>
                </div>
              </div>
            ) : (
              <div className="mobile-chapter-image-placeholder">
                <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.22em] text-[#8a9aad]/75">
                  {isImageLoading ? "Illustration being summoned..." : "Illustration waiting in the mist"}
                </p>
              </div>
            )}
          </div>

          <div className="mobile-chapter-content">
            <p className="chapter-meta book-meta-label text-[0.58rem] uppercase tracking-[0.24em] text-[#6b4a24]/70">
              Chapter {page.pageNumber}
            </p>
            <h2 className="mobile-chapter-title page-elegant-title mt-1 text-[#2a1a0c]">{page.title}</h2>

            {onNarratorClick ? (
              <div className="chapter-actions mt-3">
                <NarratorButton
                  onClick={() => onNarratorClick(activePageIndex)}
                  isLoading={isNarratorLoading && narratorActive}
                  isPlaying={isNarratorPlaying && narratorActive}
                />
              </div>
            ) : null}

            <p className="mobile-chapter-body mt-4 text-[#352820]">{page.text}</p>

            <footer className="book-meta-label mt-5 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.18em] text-[#6b4a24]/55">
              <span>Personal chronicle</span>
              <span>
                {page.pageNumber} / {pages.length}
              </span>
            </footer>
          </div>
        </article>

        {scrollFooter ? <div className="mobile-book-scroll-footer">{scrollFooter}</div> : null}
      </div>

      <div className="mobile-bottom-nav shrink-0">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!canGoPrevious || navDisabled}
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Previous
        </button>
        <span className="min-w-[4.5rem] text-center text-[0.62rem] uppercase tracking-[0.16em] text-[#9baabd]">
          Page {page.pageNumber} / {pages.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext || navDisabled}
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next
        </button>
      </div>
    </div>
  );
}
