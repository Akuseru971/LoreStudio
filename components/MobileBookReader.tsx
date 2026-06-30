"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import NarratorButton from "@/components/NarratorButton";
import LockedPageUnlockCta from "@/components/LockedPageUnlockCta";
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
  onUnlockClick?: () => void;
  scrollFooter?: ReactNode;
};

const PAGE_CHANGE_LOCK_MS = 250;

function ExpandImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3H3v6M15 3h6v6M21 15v6h-6M9 21H3v-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14h6v6M20 10h-6V4M14 10l6-6M10 14l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  onUnlockClick,
  scrollFooter,
}: MobileBookReaderProps) {
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const pageChangeTimerRef = useRef<number | null>(null);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

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
    setIsImageExpanded(false);
  }, [activePageIndex]);

  useEffect(() => {
    if (!isImageExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImageExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImageExpanded]);

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
        <article className="mobile-chapter-card">
          <div className="mobile-chapter-image-frame relative">
            {page.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.imageUrl} alt={page.title} className="mobile-chapter-image" />
                <button
                  type="button"
                  onClick={() => setIsImageExpanded(true)}
                  aria-label="View full illustration"
                  className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-[#f7ebce]/92 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                >
                  <ExpandImageIcon className="h-4 w-4" />
                </button>
              </>
            ) : imageSealed ? (
              <LockedPageUnlockCta onUnlockClick={onUnlockClick} />
            ) : (
              <div className="mobile-chapter-image-placeholder">
                <p className="book-meta-label text-[0.62rem] uppercase tracking-[0.22em] text-[#8a9aad]/75">
                  {isImageLoading ? "Illustration being summoned..." : "Illustration waiting in the mist"}
                </p>
              </div>
            )}
          </div>

          <div className="mobile-chapter-text-card">
            <p className="mobile-chapter-meta">Chapter {page.pageNumber}</p>
            <h2 className="mobile-chapter-title">{page.title}</h2>

            {onNarratorClick ? (
              <div className="chapter-actions mt-2">
                <NarratorButton
                  onClick={() => onNarratorClick(activePageIndex)}
                  isLoading={isNarratorLoading && narratorActive}
                  isPlaying={isNarratorPlaying && narratorActive}
                />
              </div>
            ) : null}

            <p className="mobile-chapter-body mt-3">{page.text}</p>

            <footer className="book-meta-label mt-4 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.18em] text-[#9baabd]/55">
              <span>Personal chronicle</span>
              <span>
                {page.pageNumber} / {pages.length}
              </span>
            </footer>
          </div>
        </article>

        {scrollFooter ? <div className="mobile-book-scroll-footer">{scrollFooter}</div> : null}
      </div>

      <div className="mobile-book-bottom-nav">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!canGoPrevious || navDisabled}
          className="mobile-book-nav-btn"
        >
          Previous
        </button>
        <span className="mobile-book-nav-page">
          Page {page.pageNumber} / {pages.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext || navDisabled}
          className="mobile-book-nav-btn"
        >
          Next
        </button>
      </div>

      {isImageExpanded && page.imageUrl ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#02030a]/92 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-label="Full illustration view"
          onClick={() => setIsImageExpanded(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsImageExpanded(false);
            }}
            aria-label="Close full illustration view"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-[2] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-[#f7ebce] shadow-[0_6px_18px_rgba(0,0,0,0.4)] backdrop-blur-sm"
          >
            <CloseImageIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.imageUrl}
            alt={page.title}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
