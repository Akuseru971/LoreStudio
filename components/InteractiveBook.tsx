"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AudioControls from "@/components/AudioControls";
import BookPage from "@/components/BookPage";
import ResultActions from "@/components/ResultActions";
import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import type { AudioSettings, LoreBook } from "@/lib/types";
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
};

const OPENING_DURATION_MS = 2100;
const NARRATION_START_DELAY_MS = 900;

export default function InteractiveBook({ book, onReset }: InteractiveBookProps) {
  const [bookState, setBookState] = useState<"closed" | "opening" | "open">("closed");
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [musicAvailable, setMusicAvailable] = useState(false);
  const [audioCache, setAudioCache] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(
      book.pages
        .filter((page) => page.audioUrl !== undefined)
        .map((page) => [page.pageNumber, page.audioUrl || null]),
    ),
  );
  const [imageCache, setImageCache] = useState<Record<number, string | null>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [revealedPages, setRevealedPages] = useState<Record<number, boolean>>({});
  const [audioDurations, setAudioDurations] = useState<Record<number, number>>({});
  const [highestReachedIndex, setHighestReachedIndex] = useState(0);
  const [hasCompletedFirstListen, setHasCompletedFirstListen] = useState(false);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>({
    musicEnabled: true,
    voiceEnabled: true,
  });

  const flipRef = useRef<PageFlipHandle | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const narrationRunRef = useRef(0);
  const autoAdvanceTimerRef = useRef<number | undefined>(undefined);
  const highestReachedRef = useRef(0);
  const hasCompletedFirstListenRef = useRef(false);
  const pagesWithImages = useMemo(
    () =>
      book.pages.map((page) => ({
        ...page,
        imageUrl: imageCache[page.pageNumber] || page.imageUrl,
      })),
    [book.pages, imageCache],
  );
  const illustratedPages = useMemo(() => pagesWithImages.slice(0, ILLUSTRATED_PAGE_COUNT), [pagesWithImages]);
  const activePage = illustratedPages[activePageIndex] || illustratedPages[0];
  const isOpen = bookState === "open";
  const isFinalPage = isOpen && activePageIndex >= illustratedPages.length - 1;
  const isGuidedFirstListen = isOpen && !hasCompletedFirstListen;
  const canLookBack = hasCompletedFirstListen || highestReachedIndex >= 4;
  const canGoPrevious = activePageIndex > 0 && canLookBack;
  const canGoNext = hasCompletedFirstListen
    ? activePageIndex < illustratedPages.length - 1
    : canLookBack && activePageIndex < highestReachedIndex;

  const coverParticles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: index,
        left: `${12 + ((index * 17) % 76)}%`,
        top: `${18 + ((index * 23) % 64)}%`,
        duration: `${4 + (index % 4)}s`,
        delay: `${index * 0.35}s`,
      })),
    [],
  );

  const characterName = book.characterBible.name;
  const showCover = bookState !== "open";
  const showOpenBook = bookState === "opening" || bookState === "open";

  useEffect(() => {
    highestReachedRef.current = highestReachedIndex;
  }, [highestReachedIndex]);

  useEffect(() => {
    hasCompletedFirstListenRef.current = hasCompletedFirstListen;
  }, [hasCompletedFirstListen]);

  useEffect(() => {
    let cancelled = false;

    fetch("/audio/mysterious-theme.mp3", { method: "HEAD" })
      .then((response) => {
        if (!cancelled) {
          setMusicAvailable(response.ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMusicAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const playMusic = useCallback(async () => {
    if (!musicAvailable || !settings.musicEnabled || !musicRef.current) {
      return;
    }

    musicRef.current.volume = 0.16;
    try {
      await musicRef.current.play();
    } catch {
      setSettings((current) => ({ ...current, musicEnabled: false }));
    }
  }, [musicAvailable, settings.musicEnabled]);

  const pauseMusic = useCallback(() => {
    musicRef.current?.pause();
  }, []);

  const fetchAudioForPage = useCallback(
    async (pageNumber: number, text: string) => {
      if (audioCache[pageNumber] !== undefined) {
        return audioCache[pageNumber];
      }

      setIsLoadingVoice(true);
      try {
        const response = await fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, pageNumber }),
        });
        const data = (await response.json()) as { audioUrl?: string | null };
        const audioUrl = data.audioUrl || null;
        setAudioCache((current) => ({ ...current, [pageNumber]: audioUrl }));
        return audioUrl;
      } catch {
        setAudioCache((current) => ({ ...current, [pageNumber]: null }));
        return null;
      } finally {
        setIsLoadingVoice(false);
      }
    },
    [audioCache],
  );

  const fetchImageForPage = useCallback(
    async (pageNumber: number) => {
      if (pageNumber < 1 || pageNumber > ILLUSTRATED_PAGE_COUNT) {
        return;
      }

      const page = book.pages.find((item) => item.pageNumber === pageNumber);
      if (!page || page.imageUrl || requestedImagesRef.current.has(pageNumber)) {
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
        setImageCache((current) => ({ ...current, [pageNumber]: data.imageUrl || null }));
      } catch {
        setImageCache((current) => ({ ...current, [pageNumber]: null }));
      } finally {
        setLoadingImages((current) => ({ ...current, [pageNumber]: false }));
      }
    },
    [book],
  );

  useEffect(() => {
    const pagesToIllustrate = book.pages.slice(0, ILLUSTRATED_PAGE_COUNT);
    void Promise.all(pagesToIllustrate.map((page) => fetchImageForPage(page.pageNumber)));
  }, [book.pages, fetchImageForPage]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
      voiceRef.current?.pause();
    };
  }, []);

  const goToSpread = useCallback(
    (pageIndex: number) => {
      const nextIndex = Math.min(Math.max(pageIndex, 0), illustratedPages.length - 1);
      setActivePageIndex(nextIndex);
      flipRef.current?.pageFlip()?.flip(nextIndex * 2, "top");
    },
    [illustratedPages.length],
  );

  const estimateReadingDuration = useCallback((text: string) => {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.min(14000, Math.max(6500, wordCount * 360));
  }, []);

  const getAudioDuration = useCallback(
    async (audio: HTMLAudioElement, fallbackText: string) =>
      new Promise<number>((resolve) => {
        const fallback = estimateReadingDuration(fallbackText);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          resolve(audio.duration * 1000);
          return;
        }

        const timeout = window.setTimeout(() => {
          cleanup();
          resolve(fallback);
        }, 900);

        function cleanup() {
          window.clearTimeout(timeout);
          audio.removeEventListener("loadedmetadata", onLoadedMetadata);
          audio.removeEventListener("durationchange", onLoadedMetadata);
        }

        function onLoadedMetadata() {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            cleanup();
            resolve(audio.duration * 1000);
          }
        }

        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("durationchange", onLoadedMetadata);
      }),
    [estimateReadingDuration],
  );

  const completeGuidedPage = useCallback(
    (pageIndex: number) => {
      if (!isOpen || hasCompletedFirstListenRef.current || pageIndex !== highestReachedRef.current) {
        return;
      }

      if (pageIndex >= illustratedPages.length - 1) {
        hasCompletedFirstListenRef.current = true;
        setHasCompletedFirstListen(true);
        return;
      }

      const nextIndex = pageIndex + 1;
      highestReachedRef.current = Math.max(highestReachedRef.current, nextIndex);
      setHighestReachedIndex((current) => Math.max(current, nextIndex));
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goToSpread(nextIndex);
      }, 900);
    },
    [goToSpread, illustratedPages.length, isOpen],
  );

  const startPageNarration = useCallback(
    async (pageIndex: number, options: { autoAdvance: boolean }) => {
      const page = illustratedPages[pageIndex];
      if (!page) {
        return;
      }

      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }

      narrationRunRef.current += 1;
      const runId = narrationRunRef.current;
      voiceRef.current?.pause();

      if (!settings.voiceEnabled) {
        const fallbackDuration = estimateReadingDuration(page.text);
        setAudioDurations((current) => ({ ...current, [page.pageNumber]: fallbackDuration / 1000 }));
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        if (options.autoAdvance) {
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            if (narrationRunRef.current === runId) {
              completeGuidedPage(pageIndex);
            }
          }, fallbackDuration);
        }
        return;
      }

      const audioUrl = await fetchAudioForPage(page.pageNumber, page.text);
      if (narrationRunRef.current !== runId) {
        return;
      }

      if (!audioUrl) {
        const fallbackDuration = estimateReadingDuration(page.text);
        setAudioDurations((current) => ({ ...current, [page.pageNumber]: fallbackDuration / 1000 }));
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        if (options.autoAdvance) {
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            if (narrationRunRef.current === runId) {
              completeGuidedPage(pageIndex);
            }
          }, fallbackDuration);
        }
        return;
      }

      if (!voiceRef.current) {
        voiceRef.current = new Audio();
      }

      const voice = voiceRef.current;
      voice.pause();
      voice.src = audioUrl;
      voice.volume = 0.82;
      const revealDuration = await getAudioDuration(voice, page.text);
      if (narrationRunRef.current !== runId) {
        return;
      }
      setAudioDurations((current) => ({ ...current, [page.pageNumber]: revealDuration / 1000 }));
      voice.onended = () => {
        if (narrationRunRef.current !== runId) {
          return;
        }
        if (options.autoAdvance) {
          completeGuidedPage(pageIndex);
        }
      };
      voice.onerror = () => {
        if (narrationRunRef.current !== runId) {
          return;
        }
        if (options.autoAdvance) {
          completeGuidedPage(pageIndex);
        }
      };

      try {
        await voice.play();
        if (narrationRunRef.current === runId) {
          setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        }
      } catch {
        const fallbackDuration = estimateReadingDuration(page.text);
        setAudioDurations((current) => ({ ...current, [page.pageNumber]: fallbackDuration / 1000 }));
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        if (options.autoAdvance) {
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            if (narrationRunRef.current === runId) {
              completeGuidedPage(pageIndex);
            }
          }, fallbackDuration);
        }
      }
    },
    [
      completeGuidedPage,
      estimateReadingDuration,
      fetchAudioForPage,
      getAudioDuration,
      illustratedPages,
      settings.voiceEnabled,
    ],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let timer: number | undefined;
    if (settings.musicEnabled) {
      timer = window.setTimeout(() => {
        void playMusic();
      }, 0);
    } else {
      pauseMusic();
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isOpen, pauseMusic, playMusic, settings.musicEnabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void startPageNarration(activePageIndex, { autoAdvance: !hasCompletedFirstListen });
    }, NARRATION_START_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePageIndex, hasCompletedFirstListen, isOpen, startPageNarration]);

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
    narrationRunRef.current += 1;
    highestReachedRef.current = 0;
    hasCompletedFirstListenRef.current = false;
    setHighestReachedIndex(0);
    setHasCompletedFirstListen(false);
    setRevealedPages({});
    setBookState("opening");
    setActivePageIndex(0);
    void playMusic();
    window.setTimeout(() => {
      setBookState("open");
    }, OPENING_DURATION_MS);
  }

  function handleFlip(event: { data?: number }) {
    const physicalPage = typeof event.data === "number" ? event.data : 0;
    const nextIndex = Math.floor(Math.max(physicalPage, 0) / 2);
    const maxAllowedIndex = hasCompletedFirstListen ? illustratedPages.length - 1 : highestReachedRef.current;
    const minAllowedIndex = hasCompletedFirstListen || canLookBack ? 0 : highestReachedRef.current;
    const boundedIndex = Math.min(Math.max(nextIndex, minAllowedIndex), maxAllowedIndex);
    setActivePageIndex(boundedIndex);
    if (boundedIndex !== nextIndex) {
      window.setTimeout(() => goToSpread(boundedIndex), 0);
    }
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
    const nextSpread = Math.min(activePageIndex + 1, illustratedPages.length - 1);
    flipRef.current?.pageFlip()?.flip(nextSpread * 2, "top");
  }

  function toggleMusic() {
    setSettings((current) => {
      const next = { ...current, musicEnabled: !current.musicEnabled };
      if (!next.musicEnabled) {
        pauseMusic();
      }
      return next;
    });
  }

  function toggleVoice() {
    setSettings((current) => {
      const next = { ...current, voiceEnabled: !current.voiceEnabled };
      if (!next.voiceEnabled) {
        voiceRef.current?.pause();
      }
      return next;
    });
  }

  return (
    <main className="archive-shell relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      {musicAvailable ? <audio ref={musicRef} src="/audio/mysterious-theme.mp3" loop preload="auto" /> : null}

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center">
        <div className="book-scene relative w-full">
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
                <div className="mb-5 text-center">
                  <p className="font-title text-[0.62rem] uppercase tracking-[0.32em] text-[#a89068]/80">
                    {activePage.chapter}
                  </p>
                  <h1 className="font-cover-title mt-2 text-2xl text-[#d4c4a0]/90 sm:text-3xl">{characterName}</h1>
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
                    useMouseEvents={!isGuidedFirstListen}
                    swipeDistance={30}
                    showPageCorners
                    disableFlipByClick={isGuidedFirstListen}
                    onFlip={handleFlip}
                  >
                    {illustratedPages.flatMap((page, index) => [
                      <div key={`${page.pageNumber}-image`} className="page">
                        <BookPage
                          page={page}
                          side="image"
                          isActive={index === activePageIndex}
                          isImageLoading={Boolean(loadingImages[page.pageNumber])}
                          isTextRevealed={Boolean(revealedPages[page.pageNumber])}
                        />
                      </div>,
                      <div key={`${page.pageNumber}-text`} className="page">
                        <BookPage
                          page={page}
                          side="text"
                          isActive={index === activePageIndex}
                          isTextRevealed={Boolean(revealedPages[page.pageNumber])}
                          audioDuration={audioDurations[page.pageNumber]}
                        />
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

                    {isGuidedFirstListen ? (
                      <p className="mx-auto mt-3 max-w-2xl text-center text-xs uppercase tracking-[0.22em] text-[#8a9aad]">
                        {highestReachedIndex < 4
                          ? "First listening in progress - pages turn with the narrator."
                          : "You may now look back, but the prophecy still unfolds forward with the voice."}
                      </p>
                    ) : null}

                    <AudioControls
                      settings={settings}
                      musicAvailable={musicAvailable}
                      isLoadingVoice={isLoadingVoice}
                      onToggleMusic={toggleMusic}
                      onToggleVoice={toggleVoice}
                      onReplayVoice={() => void startPageNarration(activePageIndex, { autoAdvance: false })}
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
                initial={{ opacity: 0, y: 32, rotateX: 6 }}
                animate={
                  bookState === "opening"
                    ? { opacity: 1, y: -14, rotateX: 0, scale: 1.08 }
                    : { opacity: 1, y: 0, rotateX: 0, scale: 1 }
                }
                exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
                transition={{ duration: bookState === "opening" ? 1.8 : 0.9, ease: "easeOut" }}
                className={cn("relative z-10 flex w-full justify-center")}
              >
                <div className="ancient-tome">
                  <div className="tome-shadow" />
                  <div className="tome-spine" aria-hidden="true" />
                  <div className="tome-pages-block" aria-hidden="true" />

                  <motion.button
                    type="button"
                    onClick={handleOpen}
                    disabled={bookState === "opening"}
                    animate={
                      bookState === "opening"
                        ? {
                            rotateY: -18,
                            boxShadow:
                              "0 2px 0 rgba(255,220,170,0.08) inset, 0 55px 120px rgba(0,0,0,0.82), 0 0 80px rgba(71,132,211,0.28), inset -20px 0 40px rgba(0,0,0,0.55)",
                          }
                        : { rotateY: 0 }
                    }
                    transition={{ duration: OPENING_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
                    className="tome-cover"
                  >
                    <div className="tome-cover-texture" aria-hidden="true" />
                    <div className="tome-embossed-border" aria-hidden="true" />
                    <div className="tome-magic-edge" aria-hidden="true" />
                    <div className="tome-magic-glow" aria-hidden="true" />

                    <motion.div
                      className="tome-opening-glow"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: bookState === "opening" ? 1 : 0 }}
                      transition={{ duration: 1.4, ease: "easeInOut" }}
                      aria-hidden="true"
                    />
                    <motion.div
                      className="tome-light-leak"
                      initial={{ opacity: 0, scaleX: 0.3 }}
                      animate={
                        bookState === "opening"
                          ? { opacity: [0, 1, 0.5], scaleX: 1 }
                          : { opacity: 0, scaleX: 0.3 }
                      }
                      transition={{ duration: 1.8, ease: "easeInOut" }}
                      aria-hidden="true"
                    />

                    {coverParticles.map((particle) => (
                      <span
                        key={particle.id}
                        className="tome-particle"
                        style={
                          {
                            left: particle.left,
                            top: particle.top,
                            "--float-duration": particle.duration,
                            "--float-delay": particle.delay,
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      />
                    ))}

                    {bookState === "opening"
                      ? coverParticles.slice(0, 5).map((particle) => (
                          <motion.span
                            key={`escape-${particle.id}`}
                            className="tome-particle"
                            style={{ left: particle.left, top: particle.top }}
                            initial={{ opacity: 0, y: 0 }}
                            animate={{ opacity: [0, 0.9, 0], y: -40, x: 12 }}
                            transition={{
                              duration: 1.6,
                              delay: particle.id * 0.12,
                              ease: "easeOut",
                            }}
                            aria-hidden="true"
                          />
                        ))
                      : null}

                    <div className="tome-title-panel">
                      <motion.h1
                        className="font-cover-title tome-cover-title"
                        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                      >
                        {characterName}
                      </motion.h1>
                    </div>

                    <div className="tome-cta">
                      <span className="tome-cta-button">
                        {bookState === "opening" ? "The archive awakens" : "Open the book"}
                      </span>
                    </div>
                  </motion.button>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
