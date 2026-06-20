"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AudioControls from "@/components/AudioControls";
import BookAtmosphere from "@/components/BookAtmosphere";
import BookPage from "@/components/BookPage";
import MagicalBookCover from "@/components/MagicalBookCover";
import BookPremiumActions from "@/components/BookPremiumActions";
import ResultActions from "@/components/ResultActions";
import UnlockFullStoryModal from "@/components/UnlockFullStoryModal";
import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { buildPageNarrationText } from "@/lib/bookNarration";
import {
  FREE_IMAGE_PAGE_COUNT,
  isPremiumImagePage,
  isSealedFreeImagePage,
  PREMIUM_IMAGE_PAGE_NUMBERS,
} from "@/lib/image-config";
import { dispatchNarrationEnd, dispatchNarrationStart } from "@/lib/narration-events";
import type { ImagePageStatus, LoreBook } from "@/lib/types";
import { cn } from "@/lib/utils";

type PageFlipHandle = {
  pageFlip: () => {
    flipPrev: () => void;
    flipNext: () => void;
    flip: (page: number, corner?: "top" | "bottom") => void;
  };
};

type PageFlipProps = {
  children: ReactNode;
  className: string;
  style: CSSProperties;
  startPage: number;
  size: "fixed" | "stretch";
  width: number;
  height: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  drawShadow: boolean;
  flippingTime: number;
  usePortrait: boolean;
  startZIndex: number;
  autoSize: boolean;
  maxShadowOpacity: number;
  showCover: boolean;
  mobileScrollSupport: boolean;
  clickEventForward: boolean;
  useMouseEvents: boolean;
  swipeDistance: number;
  showPageCorners: boolean;
  disableFlipByClick: boolean;
  onFlip?: (event: { data?: number }) => void;
};

const HTMLFlipBook = dynamic<PageFlipProps & RefAttributes<PageFlipHandle>>(
  () =>
    import("react-pageflip").then(
      (mod) => mod.default as unknown as ComponentType<PageFlipProps & RefAttributes<PageFlipHandle>>,
    ),
  {
    ssr: false,
  },
);

type InteractiveBookProps = {
  book: LoreBook;
  onReset: () => void;
  accessToken?: string;
  isPremium?: boolean;
  canDownloadPdf?: boolean;
  canDownloadMp3?: boolean;
  initialPageIndex?: number;
  onReadingStateChange?: (isReading: boolean) => void;
};

const OPENING_DURATION_MS = 2100;
const NARRATION_START_DELAY_MS = 400;
const PAGE_FIVE_INDEX = ILLUSTRATED_PAGE_COUNT - 1;

export default function InteractiveBook({
  book,
  onReset,
  accessToken,
  isPremium = false,
  canDownloadPdf = false,
  canDownloadMp3 = false,
  initialPageIndex = 0,
  onReadingStateChange,
}: InteractiveBookProps) {
  const [bookState, setBookState] = useState<"closed" | "opening" | "open">("closed");
  const [activePageIndex, setActivePageIndex] = useState(initialPageIndex);
  const [audioCache, setAudioCache] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      book.pages
        .filter((page) => Boolean(page.audioUrl))
        .map((page) => [page.pageNumber, page.audioUrl as string]),
    ),
  );
  const [imageCache, setImageCache] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      book.pages
        .filter((page) => Boolean(page.imageUrl))
        .map((page) => [page.pageNumber, page.imageUrl as string]),
    ),
  );
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const flipRef = useRef<PageFlipHandle | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const narrationRunRef = useRef(0);

  const pagesWithImages = useMemo(
    () =>
      book.pages.map((page) => ({
        ...page,
        imageUrl: imageCache[page.pageNumber] ?? page.imageUrl,
      })),
    [book.pages, imageCache],
  );
  const pageLimit = isPremium ? FULL_BOOK_PAGE_COUNT : ILLUSTRATED_PAGE_COUNT;
  const illustratedPages = useMemo(() => pagesWithImages.slice(0, pageLimit), [pagesWithImages, pageLimit]);
  const activePage = illustratedPages[activePageIndex] || illustratedPages[0];
  const isOpen = bookState === "open";
  const isFinalPage = isOpen && activePageIndex >= illustratedPages.length - 1;
  const canGoPrevious = activePageIndex > 0;
  const canGoNext = isPremium
    ? activePageIndex < illustratedPages.length - 1
    : activePageIndex <= PAGE_FIVE_INDEX;

  const escapeParticles = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: index,
        left: `${20 + ((index * 19) % 60)}%`,
        top: `${25 + ((index * 21) % 50)}%`,
      })),
    [],
  );

  const characterName = book.characterBible.name;
  const showCover = bookState !== "open";
  const showOpenBook = bookState === "opening" || bookState === "open";

  useEffect(() => {
    onReadingStateChange?.(bookState === "open");
  }, [bookState, onReadingStateChange]);

  useEffect(() => {
    return () => {
      onReadingStateChange?.(false);
      dispatchNarrationEnd();
      voiceRef.current?.pause();
    };
  }, [onReadingStateChange]);

  const fetchAudioForPage = useCallback(
    async (pageNumber: number, text: string) => {
      const cachedAudio = audioCache[pageNumber];
      if (cachedAudio) {
        return cachedAudio;
      }

      setIsLoadingVoice(true);
      try {
        const response = await fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, pageNumber }),
        });
        const data = (await response.json()) as { audioUrl?: string | null; error?: string };
        const audioUrl = data.audioUrl || null;
        if (audioUrl) {
          setAudioCache((current) => ({ ...current, [pageNumber]: audioUrl }));
        }
        return audioUrl;
      } catch {
        return null;
      } finally {
        setIsLoadingVoice(false);
      }
    },
    [audioCache],
  );

  const fetchImageForPage = useCallback(
    async (pageNumber: number) => {
      if (pageNumber < 1 || pageNumber > FULL_BOOK_PAGE_COUNT) {
        return;
      }

      if (!isPremium && pageNumber > FREE_IMAGE_PAGE_COUNT) {
        return;
      }

      if (isPremium && isPremiumImagePage(pageNumber)) {
        return;
      }

      const page = book.pages.find((item) => item.pageNumber === pageNumber);
      const cachedImage = imageCache[pageNumber] ?? page?.imageUrl;
      if (!page || cachedImage || requestedImagesRef.current.has(pageNumber)) {
        return;
      }

      requestedImagesRef.current.add(pageNumber);
      setLoadingImages((current) => ({ ...current, [pageNumber]: true }));

      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book, pageNumber }),
        });
        const data = (await response.json()) as { imageUrl?: string | null };
        if (data.imageUrl) {
          setImageCache((current) => ({ ...current, [pageNumber]: data.imageUrl as string }));
        } else {
          console.warn(`[IMAGE] Missing illustration for page ${pageNumber}.`);
        }
      } catch (error) {
        console.warn(`[IMAGE] Failed to load illustration for page ${pageNumber}.`, error);
      } finally {
        requestedImagesRef.current.delete(pageNumber);
        setLoadingImages((current) => ({ ...current, [pageNumber]: false }));
      }
    },
    [book, imageCache, isPremium],
  );

  const refreshPremiumImages = useCallback(async (): Promise<boolean> => {
    if (!accessToken || !isPremium) {
      return true;
    }

    const response = await fetch("/api/book?token=" + encodeURIComponent(accessToken));
    const data = (await response.json()) as {
      book?: LoreBook | null;
      imageStatus?: Record<string, { status: ImagePageStatus; url?: string | null }>;
    };

    if (!response.ok || !data.book) {
      return false;
    }

    const nextCache: Record<number, string> = {};
    for (const page of data.book.pages) {
      if (page.imageUrl) {
        nextCache[page.pageNumber] = page.imageUrl;
      }
    }

    setImageCache((current) => ({ ...current, ...nextCache }));

    const imageStatus = data.imageStatus || {};
    let allPremiumReady = true;

    const nextLoading: Record<number, boolean> = {};
    for (const pageNumber of PREMIUM_IMAGE_PAGE_NUMBERS) {
      const state = imageStatus[String(pageNumber)];
      const page = data.book.pages.find((item) => item.pageNumber === pageNumber);

      if (state?.status === "generating") {
        nextLoading[pageNumber] = true;
        allPremiumReady = false;
        continue;
      }

      if (state?.status === "ready" && page?.imageUrl) {
        nextLoading[pageNumber] = false;
        continue;
      }

      allPremiumReady = false;
    }

    setLoadingImages((current) => ({ ...current, ...nextLoading }));

    return allPremiumReady;
  }, [accessToken, isPremium]);

  useEffect(() => {
    const pagesToIllustrate = book.pages.slice(0, isPremium ? FULL_BOOK_PAGE_COUNT : FREE_IMAGE_PAGE_COUNT);
    void Promise.all(pagesToIllustrate.map((page) => fetchImageForPage(page.pageNumber)));
  }, [book.pages, fetchImageForPage, isPremium]);

  useEffect(() => {
    if (!isPremium || !accessToken) {
      return;
    }

    let cancelled = false;

    async function runPremiumImages() {
      await fetch("/api/generate-premium-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      while (!cancelled) {
        const allReady = await refreshPremiumImages();
        if (allReady) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
    }

    void runPremiumImages();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isPremium, refreshPremiumImages]);

  const tryForwardNavigation = useCallback(
    (targetIndex: number) => {
      if (!isPremium && activePageIndex === PAGE_FIVE_INDEX && targetIndex > PAGE_FIVE_INDEX) {
        setShowUnlockModal(true);
        return false;
      }

      return targetIndex <= illustratedPages.length - 1;
    },
    [activePageIndex, illustratedPages.length, isPremium],
  );

  const goToSpread = useCallback(
    (pageIndex: number) => {
      const nextIndex = Math.min(Math.max(pageIndex, 0), illustratedPages.length - 1);
      setActivePageIndex(nextIndex);
      flipRef.current?.pageFlip()?.flip(nextIndex * 2, "top");
    },
    [illustratedPages.length],
  );

  const stopNarration = useCallback(() => {
    narrationRunRef.current += 1;
    voiceRef.current?.pause();
    dispatchNarrationEnd();
  }, []);

  const startPageNarration = useCallback(
    async (pageIndex: number) => {
      const page = illustratedPages[pageIndex];
      if (!page || !voiceEnabled) {
        return;
      }

      narrationRunRef.current += 1;
      const runId = narrationRunRef.current;
      voiceRef.current?.pause();
      dispatchNarrationEnd();

      const audioUrl = await fetchAudioForPage(page.pageNumber, buildPageNarrationText(page));
      if (narrationRunRef.current !== runId) {
        return;
      }

      if (!audioUrl) {
        return;
      }

      if (!voiceRef.current) {
        voiceRef.current = new Audio();
      }

      const voice = voiceRef.current;
      voice.pause();
      voice.src = audioUrl;
      voice.volume = 0.82;
      voice.onended = () => {
        if (narrationRunRef.current === runId) {
          dispatchNarrationEnd();
        }
      };
      voice.onerror = () => {
        if (narrationRunRef.current === runId) {
          dispatchNarrationEnd();
        }
      };

      try {
        dispatchNarrationStart();
        await voice.play();
      } catch {
        if (narrationRunRef.current === runId) {
          dispatchNarrationEnd();
        }
      }
    },
    [fetchAudioForPage, illustratedPages, voiceEnabled],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void startPageNarration(activePageIndex);
    }, NARRATION_START_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      stopNarration();
    };
  }, [activePageIndex, isOpen, startPageNarration, stopNarration]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const page = illustratedPages[activePageIndex];
    if (!page) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchImageForPage(page.pageNumber);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePageIndex, fetchImageForPage, illustratedPages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const orderedPages = [
      ...illustratedPages.slice(activePageIndex),
      ...illustratedPages.slice(0, activePageIndex),
    ];

    async function prefetchImages() {
      for (const page of orderedPages) {
        if (cancelled) {
          return;
        }
        await fetchImageForPage(page.pageNumber);
      }
    }

    void prefetchImages();

    return () => {
      cancelled = true;
    };
  }, [activePageIndex, fetchImageForPage, illustratedPages, isOpen]);

  function handleOpen() {
    if (bookState !== "closed") {
      return;
    }

    stopNarration();
    setShowUnlockModal(false);
    setBookState("opening");
    setActivePageIndex(initialPageIndex);
    window.setTimeout(() => {
      setBookState("open");
      if (initialPageIndex > 0) {
        flipRef.current?.pageFlip()?.flip(initialPageIndex * 2, "top");
      }
    }, OPENING_DURATION_MS);
  }

  function handleFlip(event: { data?: number }) {
    const physicalPage = typeof event.data === "number" ? event.data : 0;
    const nextIndex = Math.floor(Math.max(physicalPage, 0) / 2);
    const boundedIndex = Math.min(Math.max(nextIndex, 0), illustratedPages.length - 1);

    if (boundedIndex > activePageIndex && !tryForwardNavigation(boundedIndex)) {
      window.setTimeout(() => goToSpread(activePageIndex), 0);
      return;
    }

    setActivePageIndex(boundedIndex);
  }

  function flipPrevious() {
    if (!canGoPrevious) {
      return;
    }
    const previousSpread = Math.max(activePageIndex - 1, 0);
    flipRef.current?.pageFlip()?.flip(previousSpread * 2, "top");
  }

  function flipNext() {
    if (!canGoNext) {
      return;
    }

    const nextIndex = activePageIndex + 1;
    if (!tryForwardNavigation(nextIndex)) {
      return;
    }

    const nextSpread = Math.min(nextIndex, illustratedPages.length - 1);
    flipRef.current?.pageFlip()?.flip(nextSpread * 2, "top");
  }

  function handleClosePaywall() {
    setShowUnlockModal(false);
  }

  function toggleVoice() {
    setVoiceEnabled((current) => {
      const next = !current;
      if (!next) {
        stopNarration();
      }
      return next;
    });
  }

  return (
    <main className="archive-shell relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center">
        <div className="book-scene relative w-full">
          {showOpenBook && bookState === "open" ? (
            <div className="pointer-events-none absolute inset-0 z-0 flex justify-center">
              <div className="relative h-full w-full max-w-4xl">
                <BookAtmosphere intensity="open" />
              </div>
            </div>
          ) : null}

          <AnimatePresence>
            {showOpenBook ? (
              <motion.section
                key="pages"
                initial={{ opacity: 0, y: 28, scale: 0.94 }}
                animate={
                  bookState === "opening"
                    ? { opacity: 0.2, y: 8, scale: 0.98 }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: bookState === "opening" ? 1.6 : 0.85, ease: "easeOut" }}
                className={cn(
                  "w-full",
                  bookState === "opening" ? "pointer-events-none absolute inset-x-0 top-0" : "relative",
                )}
                aria-hidden={bookState === "opening"}
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 text-center sm:text-left">
                  <div className="mx-auto sm:mx-0">
                    <p className="font-title text-[0.62rem] uppercase tracking-[0.32em] text-[#a89068]/80">
                      Chapter {activePage.pageNumber}
                    </p>
                    <h1 className="font-cover-title mt-2 text-2xl text-[#d4c4a0]/90 sm:text-3xl">{activePage.title}</h1>
                    <p className="mt-2 text-sm text-[#a89068]/70">{characterName}</p>
                  </div>
                  {isPremium && accessToken ? (
                    <BookPremiumActions accessToken={accessToken} className="mx-auto sm:mx-0" />
                  ) : null}
                </div>

                <div className="mx-auto flex w-full max-w-6xl justify-center overflow-visible">
                  <HTMLFlipBook
                    ref={flipRef}
                    className="pageflip-root"
                    style={{}}
                    startPage={0}
                    size="stretch"
                    width={420}
                    height={640}
                    minWidth={300}
                    maxWidth={460}
                    minHeight={500}
                    maxHeight={700}
                    drawShadow
                    flippingTime={950}
                    usePortrait
                    startZIndex={0}
                    autoSize
                    maxShadowOpacity={0.55}
                    showCover={false}
                    mobileScrollSupport
                    clickEventForward
                    useMouseEvents
                    swipeDistance={30}
                    showPageCorners
                    disableFlipByClick={false}
                    onFlip={handleFlip}
                  >
                    {illustratedPages.flatMap((page, index) => [
                      <div key={`${page.pageNumber}-image`} className="page">
                        <BookPage
                          page={page}
                          side="image"
                          isActive={index === activePageIndex}
                          isImageLoading={Boolean(loadingImages[page.pageNumber])}
                          imageSealed={!isPremium && isSealedFreeImagePage(page.pageNumber)}
                        />
                      </div>,
                      <div key={`${page.pageNumber}-text`} className="page">
                        <BookPage page={page} side="text" isActive={index === activePageIndex} />
                      </div>,
                    ])}
                  </HTMLFlipBook>
                </div>

                {isOpen ? (
                  <>
                    <div className="mx-auto mt-5 flex max-w-3xl items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={flipPrevious}
                        disabled={!canGoPrevious}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={flipNext}
                        disabled={!canGoNext}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#a89068]/45 hover:text-[#e8dcc0] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Next page
                      </button>
                    </div>

                    <AudioControls
                      voiceEnabled={voiceEnabled}
                      isLoadingVoice={isLoadingVoice}
                      onToggleVoice={toggleVoice}
                      onReplayVoice={() => void startPageNarration(activePageIndex)}
                    />

                    {isFinalPage ? <ResultActions onReset={onReset} /> : null}
                  </>
                ) : null}
              </motion.section>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {showCover ? (
              <motion.section
                key="cover"
                initial={{ opacity: 0, y: 36, rotateX: 8 }}
                animate={
                  bookState === "opening"
                    ? { opacity: 1, y: -16, rotateX: 0, scale: 1.06 }
                    : { opacity: 1, y: 0, rotateX: 0, scale: 1 }
                }
                exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
                transition={{ duration: bookState === "opening" ? 1.9 : 0.95, ease: "easeOut" }}
                className="relative z-10 flex w-full justify-center"
              >
                <MagicalBookCover
                  bookState={bookState}
                  openingDurationMs={OPENING_DURATION_MS}
                  onOpen={handleOpen}
                  escapeParticles={escapeParticles}
                />
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {accessToken && !isPremium ? (
        <UnlockFullStoryModal
          book={book}
          accessToken={accessToken}
          isOpen={showUnlockModal}
          onClose={handleClosePaywall}
        />
      ) : null}
    </main>
  );
}
