"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AudioControls from "@/components/AudioControls";
import BookAtmosphere from "@/components/BookAtmosphere";
import BookPage from "@/components/BookPage";
import MagicalBookCover from "@/components/MagicalBookCover";
import MobileBookReader from "@/components/MobileBookReader";
import BookPremiumActions from "@/components/BookPremiumActions";
import NarratorUnlockModal from "@/components/NarratorUnlockModal";
import ResultActions from "@/components/ResultActions";
import UnlockFullStoryModal from "@/components/UnlockFullStoryModal";
import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { buildPageNarrationText } from "@/lib/bookNarration";
import {
  FREE_IMAGE_PAGE_COUNT,
  isPremiumImageLockedBeforePayment,
  isPremiumImagePage,
  isSealedFreeImagePage,
  PREMIUM_IMAGE_PAGE_NUMBERS,
} from "@/lib/image-config";
import { dispatchNarrationEnd, dispatchNarrationStart } from "@/lib/narration-events";
import { getDirectImageUrl, logBookImageRender } from "@/lib/book-image-utils";
import { useIsMobile } from "@/lib/useIsMobile";
import { fetchBook, generateImage, generateNarratorTeaser, generatePageAudio } from "@/lib/client/api";
import { startPremiumGenerationLoop } from "@/lib/client/premium-generation";
import { normalizeBook } from "@/lib/normalizeBook";
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
  const safeBook = useMemo(() => normalizeBook(book) ?? book, [book]);
  const safePages = useMemo(
    () => (Array.isArray(safeBook.pages) ? safeBook.pages : []),
    [safeBook.pages],
  );

  const [bookState, setBookState] = useState<"closed" | "opening" | "open">("closed");
  const [activePageIndex, setActivePageIndex] = useState(initialPageIndex);
  const [audioCache, setAudioCache] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      safePages
        .filter((page) => Boolean(page.audioUrl))
        .map((page) => [page.pageNumber, page.audioUrl as string]),
    ),
  );
  const [imageCache, setImageCache] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      safePages
        .filter((page) => Boolean(page.imageUrl))
        .map((page) => [page.pageNumber, page.imageUrl as string]),
    ),
  );
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showNarratorModal, setShowNarratorModal] = useState(false);
  const [narratorTeaserAudioUrl, setNarratorTeaserAudioUrl] = useState<string | null>(null);
  const [narrationPageIndex, setNarrationPageIndex] = useState<number | null>(null);
  const [isNarratorPlaying, setIsNarratorPlaying] = useState(false);
  const [narratorError, setNarratorError] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const flipRef = useRef<PageFlipHandle | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const teaserRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const narrationRunRef = useRef(0);

  const pagesWithImages = useMemo(
    () =>
      safePages.map((page) => {
        const cachedImageUrl = imageCache[page.pageNumber] ?? page.imageUrl ?? null;
        const imageUrl =
          !isPremium && isPremiumImageLockedBeforePayment(page.pageNumber)
            ? undefined
            : cachedImageUrl ?? undefined;
        logBookImageRender(page.pageNumber, imageUrl ? { pageNumber: page.pageNumber, status: "ready", url: imageUrl } : null);
        return {
          ...page,
          imageUrl,
        };
      }),
    [safePages, imageCache, isPremium],
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

  const characterName = safeBook.characterBible?.name || safeBook.title || "Your legend";
  const showCover = bookState !== "open";
  const showOpenBook = bookState === "opening" || bookState === "open";

  const imageSealedForPage = useCallback(
    (pageNumber: number) => !isPremium && isSealedFreeImagePage(pageNumber),
    [isPremium],
  );

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
      if (!isPremium || !accessToken) {
        return null;
      }

      const cachedAudio = audioCache[pageNumber];
      if (cachedAudio) {
        return cachedAudio;
      }

      const pageAudioUrl = illustratedPages.find((page) => page.pageNumber === pageNumber)?.audioUrl;
      if (pageAudioUrl) {
        setAudioCache((current) => ({ ...current, [pageNumber]: pageAudioUrl }));
        return pageAudioUrl;
      }

      setIsLoadingVoice(true);
      try {
        const { data } = await generatePageAudio({ text, pageNumber, accessToken: accessToken as string });
        const audioUrl = (data as { audioUrl?: string | null }).audioUrl || null;
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
    [accessToken, audioCache, illustratedPages, isPremium],
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

      const page = safePages.find((item) => item.pageNumber === pageNumber);
      const cachedImage = imageCache[pageNumber] ?? page?.imageUrl;
      if (!page || cachedImage || requestedImagesRef.current.has(pageNumber)) {
        return;
      }

      requestedImagesRef.current.add(pageNumber);
      setLoadingImages((current) => ({ ...current, [pageNumber]: true }));

      try {
        const { data } = await generateImage({ book: safeBook, pageNumber });
        const imageUrl = (data as { imageUrl?: string | null }).imageUrl || null;
        if (imageUrl) {
          setImageCache((current) => ({ ...current, [pageNumber]: imageUrl }));
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
    [safeBook, imageCache, isPremium],
  );

  const refreshBookImages = useCallback(async (): Promise<boolean> => {
    if (!accessToken) {
      return true;
    }

    const { response, data } = await fetchBook(accessToken);
    const bookData = data as {
      book?: LoreBook | null;
      images?: Record<string, { status: ImagePageStatus; url?: string | null; storagePath?: string | null }>;
      imageStatus?: Record<string, { status: ImagePageStatus; url?: string | null; storagePath?: string | null }>;
      allIllustrationsReady?: boolean;
    };

    if (!response.ok || !bookData.book) {
      return false;
    }

    const normalizedBook = normalizeBook(bookData.book);
    if (!normalizedBook) {
      return false;
    }

    const bookPages = Array.isArray(normalizedBook.pages) ? normalizedBook.pages : [];
    const imageMap = bookData.images || bookData.imageStatus || {};
    const pageLimit = isPremium ? FULL_BOOK_PAGE_COUNT : FREE_IMAGE_PAGE_COUNT;
    const nextCache: Record<number, string> = {};

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const state = imageMap[String(pageNumber)];
      const page = bookPages.find((item) => item.pageNumber === pageNumber);
      const url = getDirectImageUrl(state) || page?.imageUrl || null;
      if (url) {
        nextCache[pageNumber] = url;
      }
    }

    setImageCache((current) => ({ ...current, ...nextCache }));

    const nextLoading: Record<number, boolean> = {};
    for (const pageNumber of PREMIUM_IMAGE_PAGE_NUMBERS) {
      const state = imageMap[String(pageNumber)];
      const page = bookPages.find((item) => item.pageNumber === pageNumber);
      const hasImage = Boolean(getDirectImageUrl(state) || page?.imageUrl);

      if (state?.status === "generating" && !hasImage) {
        nextLoading[pageNumber] = true;
        continue;
      }

      nextLoading[pageNumber] = false;
    }

    setLoadingImages((current) => ({ ...current, ...nextLoading }));

    return Boolean(bookData.allIllustrationsReady);
  }, [accessToken, isPremium]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void refreshBookImages();
  }, [accessToken, isPremium, refreshBookImages]);

  useEffect(() => {
    const pagesToIllustrate = safePages.slice(0, isPremium ? FULL_BOOK_PAGE_COUNT : FREE_IMAGE_PAGE_COUNT);
    void Promise.all(pagesToIllustrate.map((page) => fetchImageForPage(page.pageNumber)));
  }, [safePages, fetchImageForPage, isPremium]);

  useEffect(() => {
    if (!isPremium || !accessToken) {
      return;
    }

    void startPremiumGenerationLoop(accessToken);
  }, [accessToken, isPremium]);

  const stopNarration = useCallback(() => {
    narrationRunRef.current += 1;
    voiceRef.current?.pause();
    teaserRef.current?.pause();
    setIsNarratorPlaying(false);
    setNarrationPageIndex(null);
    dispatchNarrationEnd();
  }, []);

  const tryForwardNavigation = useCallback(
    (targetIndex: number) => {
      if (!isPremium && activePageIndex === PAGE_FIVE_INDEX && targetIndex > PAGE_FIVE_INDEX) {
        stopNarration();
        setShowUnlockModal(true);
        return false;
      }

      return targetIndex <= illustratedPages.length - 1;
    },
    [activePageIndex, illustratedPages.length, isPremium, stopNarration],
  );

  const handleUnlockClick = useCallback(() => {
    stopNarration();
    setShowUnlockModal(true);
  }, [stopNarration]);

  const goToSpread = useCallback(
    (pageIndex: number) => {
      const nextIndex = Math.min(Math.max(pageIndex, 0), illustratedPages.length - 1);
      setActivePageIndex(nextIndex);
      flipRef.current?.pageFlip()?.flip(nextIndex * 2, "top");
    },
    [illustratedPages.length],
  );

  const playNarratorTeaser = useCallback(async () => {
    stopNarration();

    let audioUrl = narratorTeaserAudioUrl;
    if (!audioUrl) {
      try {
        const { data } = await generateNarratorTeaser();
        const teaserData = data as { audioUrl?: string | null };
        audioUrl = teaserData.audioUrl || null;
        if (audioUrl) {
          setNarratorTeaserAudioUrl(audioUrl);
        }
      } catch {
        return;
      }
    }

    if (!audioUrl) {
      return;
    }

    if (!teaserRef.current) {
      teaserRef.current = new Audio();
    }

    const teaser = teaserRef.current;
    teaser.pause();
    teaser.src = audioUrl;
    teaser.volume = 0.82;
    teaser.onended = () => {
      dispatchNarrationEnd();
    };
    teaser.onerror = () => {
      dispatchNarrationEnd();
    };

    try {
      dispatchNarrationStart();
      await teaser.play();
    } catch {
      dispatchNarrationEnd();
    }
  }, [narratorTeaserAudioUrl, stopNarration]);

  const startPageNarration = useCallback(
    async (pageIndex: number) => {
      const page = illustratedPages[pageIndex];
      if (!page || !voiceEnabled || !isPremium) {
        return;
      }

      narrationRunRef.current += 1;
      const runId = narrationRunRef.current;
      teaserRef.current?.pause();
      voiceRef.current?.pause();
      dispatchNarrationEnd();
      setNarrationPageIndex(pageIndex);
      setNarratorError(null);

      const audioUrl = await fetchAudioForPage(page.pageNumber, buildPageNarrationText(page));
      if (narrationRunRef.current !== runId) {
        return;
      }

      if (!audioUrl) {
        setNarratorError("The narrator could not be summoned. Please try again.");
        setNarrationPageIndex(null);
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
          setIsNarratorPlaying(false);
          setNarrationPageIndex(null);
          dispatchNarrationEnd();
        }
      };
      voice.onerror = () => {
        if (narrationRunRef.current === runId) {
          setIsNarratorPlaying(false);
          setNarrationPageIndex(null);
          dispatchNarrationEnd();
        }
      };

      try {
        dispatchNarrationStart();
        setIsNarratorPlaying(true);
        await voice.play();
      } catch {
        if (narrationRunRef.current === runId) {
          setIsNarratorPlaying(false);
          setNarrationPageIndex(null);
          dispatchNarrationEnd();
        }
      }
    },
    [fetchAudioForPage, illustratedPages, isPremium, voiceEnabled],
  );

  const handleNarratorClick = useCallback(
    async (pageIndex: number) => {
      if (!accessToken) {
        return;
      }

      if (!isPremium) {
        stopNarration();
        setShowNarratorModal(true);
        await playNarratorTeaser();
        return;
      }

      if (narrationPageIndex === pageIndex && isNarratorPlaying) {
        stopNarration();
        return;
      }

      await startPageNarration(pageIndex);
    },
    [
      accessToken,
      isNarratorPlaying,
      isPremium,
      narrationPageIndex,
      playNarratorTeaser,
      startPageNarration,
      stopNarration,
    ],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    stopNarration();
  }, [activePageIndex, isOpen, stopNarration]);

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
    const openingDelay = isMobile ? 900 : OPENING_DURATION_MS;
    window.setTimeout(() => {
      setBookState("open");
      if (!isMobile && initialPageIndex > 0) {
        flipRef.current?.pageFlip()?.flip(initialPageIndex * 2, "top");
      }
    }, openingDelay);
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

    if (isMobile) {
      setActivePageIndex((current) => Math.max(current - 1, 0));
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

    if (isMobile) {
      setActivePageIndex(nextIndex);
      return;
    }

    const nextSpread = Math.min(nextIndex, illustratedPages.length - 1);
    flipRef.current?.pageFlip()?.flip(nextSpread * 2, "top");
  }

  function handleClosePaywall() {
    stopNarration();
    setShowUnlockModal(false);
  }

  function handleCloseNarratorModal() {
    teaserRef.current?.pause();
    dispatchNarrationEnd();
    setShowNarratorModal(false);
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

  if (!illustratedPages.length || !activePage) {
    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5 py-10">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-2xl text-[#f7ebce]">The archive failed to open this page</h1>
          <p className="mt-4 text-sm leading-7 text-[#9baabd]">
            Some assets are still being prepared, or this legend uses an older archive shape. Please reload or return
            home.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="gold-button mt-6 rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
          >
            Return
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "archive-shell relative px-4 py-8 sm:px-6 lg:px-8",
        isMobile && isOpen ? "h-dvh overflow-hidden py-4" : "min-h-screen",
      )}
    >
      <div
        className={cn(
          "relative z-10 mx-auto flex max-w-7xl flex-col items-center",
          isMobile && isOpen ? "h-full min-h-0 justify-start" : "min-h-[calc(100vh-4rem)] justify-center",
        )}
      >
        <div className={cn("book-scene relative w-full", isMobile && isOpen && "flex min-h-0 flex-1 flex-col")}>
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
                transition={{ duration: isMobile ? 0.45 : bookState === "opening" ? 1.6 : 0.85, ease: "easeOut" }}
                className={cn(
                  "w-full",
                  isMobile && isOpen && "flex min-h-0 flex-1 flex-col",
                  bookState === "opening" ? "pointer-events-none absolute inset-x-0 top-0" : "relative",
                )}
                aria-hidden={bookState === "opening"}
              >
                {!(isMobile && isOpen) ? (
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
                ) : isPremium && accessToken ? (
                  <div className="mb-2 flex shrink-0 justify-end">
                    <BookPremiumActions accessToken={accessToken} />
                  </div>
                ) : null}

                <div className={cn("mx-auto flex w-full justify-center overflow-visible", isMobile && "min-h-0 flex-1")}>
                  {isMobile ? (
                    <MobileBookReader
                      pages={illustratedPages}
                      activePageIndex={activePageIndex}
                      loadingImages={loadingImages}
                      imageSealedForPage={imageSealedForPage}
                      onUnlockClick={!isPremium ? handleUnlockClick : undefined}
                      onNarratorClick={accessToken ? (pageIndex) => void handleNarratorClick(pageIndex) : undefined}
                      isNarratorLoading={isLoadingVoice}
                      isNarratorPlaying={isNarratorPlaying}
                      narrationPageIndex={narrationPageIndex}
                      onPrevious={flipPrevious}
                      onNext={flipNext}
                      canGoPrevious={canGoPrevious}
                      canGoNext={canGoNext}
                      scrollFooter={
                        <>
                          {isPremium ? (
                            <AudioControls
                              voiceEnabled={voiceEnabled}
                              isLoadingVoice={isLoadingVoice}
                              onToggleVoice={toggleVoice}
                              onReplayVoice={() => void startPageNarration(activePageIndex)}
                            />
                          ) : null}
                          {narratorError ? (
                            <p className="mt-3 text-center text-xs text-red-300">{narratorError}</p>
                          ) : null}
                          {isFinalPage ? <ResultActions onReset={onReset} /> : null}
                        </>
                      }
                    />
                  ) : (
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
                          imageSealed={imageSealedForPage(page.pageNumber)}
                          onUnlockClick={!isPremium ? handleUnlockClick : undefined}
                          onNarratorClick={undefined}
                          isNarratorLoading={isLoadingVoice && narrationPageIndex === index}
                          isNarratorPlaying={isNarratorPlaying && narrationPageIndex === index}
                        />
                      </div>,
                      <div key={`${page.pageNumber}-text`} className="page">
                        <BookPage
                          page={page}
                          side="text"
                          isActive={index === activePageIndex}
                          onNarratorClick={accessToken ? () => void handleNarratorClick(index) : undefined}
                          isNarratorLoading={isLoadingVoice && narrationPageIndex === index}
                          isNarratorPlaying={isNarratorPlaying && narrationPageIndex === index}
                        />
                      </div>,
                    ])}
                  </HTMLFlipBook>
                  )}
                </div>

                {isOpen && !isMobile ? (
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

                    {isPremium ? (
                      <AudioControls
                        voiceEnabled={voiceEnabled}
                        isLoadingVoice={isLoadingVoice}
                        onToggleVoice={toggleVoice}
                        onReplayVoice={() => void startPageNarration(activePageIndex)}
                      />
                    ) : null}

                    {narratorError ? <p className="mt-3 text-center text-xs text-red-300">{narratorError}</p> : null}

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
        <>
          <UnlockFullStoryModal
            book={safeBook}
            accessToken={accessToken}
            isOpen={showUnlockModal}
            onClose={handleClosePaywall}
          />
          <NarratorUnlockModal
            accessToken={accessToken}
            isOpen={showNarratorModal}
            onClose={handleCloseNarratorModal}
          />
        </>
      ) : null}
    </main>
  );
}
