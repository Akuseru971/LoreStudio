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

export default function InteractiveBook({ book, onReset }: InteractiveBookProps) {
  const [isOpen, setIsOpen] = useState(false);
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
  const [revealedWordCounts, setRevealedWordCounts] = useState<Record<number, number>>({});
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
  const wordRevealFrameRef = useRef<number | undefined>(undefined);
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
  const isFinalPage = isOpen && activePageIndex >= illustratedPages.length - 1;
  const isGuidedFirstListen = isOpen && !hasCompletedFirstListen;
  const canLookBack = hasCompletedFirstListen || highestReachedIndex >= 4;
  const canGoPrevious = activePageIndex > 0 && canLookBack;
  const canGoNext = hasCompletedFirstListen
    ? activePageIndex < illustratedPages.length - 1
    : canLookBack && activePageIndex < highestReachedIndex;

  const coverMarks = useMemo(() => ["I", "II", "III", "IV"], []);

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
      if (wordRevealFrameRef.current) {
        window.cancelAnimationFrame(wordRevealFrameRef.current);
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

  const startWordReveal = useCallback((
    pageNumber: number,
    text: string,
    durationMs: number,
    runId: number,
    audio?: HTMLAudioElement,
  ) => {
    if (wordRevealFrameRef.current) {
      window.cancelAnimationFrame(wordRevealFrameRef.current);
    }

    const words = text.trim().split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    if (!totalWords) {
      return;
    }

    setRevealedWordCounts((current) => ({ ...current, [pageNumber]: 0 }));
    const startedAt = performance.now();
    let lastVisibleWords = -1;

    function tick() {
      if (narrationRunRef.current !== runId) {
        return;
      }

      const elapsedMs =
        audio && !audio.paused && Number.isFinite(audio.currentTime)
          ? audio.currentTime * 1000
          : performance.now() - startedAt;
      const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
      const visibleWords = progress > 0 ? Math.min(totalWords, Math.max(1, Math.ceil(progress * totalWords))) : 0;

      if (visibleWords !== lastVisibleWords) {
        lastVisibleWords = visibleWords;
        setRevealedWordCounts((current) => ({
          ...current,
          [pageNumber]: visibleWords,
        }));
      }

      if (progress < 1) {
        wordRevealFrameRef.current = window.requestAnimationFrame(tick);
      }
    }

    wordRevealFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

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
      if (wordRevealFrameRef.current) {
        window.cancelAnimationFrame(wordRevealFrameRef.current);
      }

      narrationRunRef.current += 1;
      const runId = narrationRunRef.current;
      voiceRef.current?.pause();
      setRevealedWordCounts((current) => ({ ...current, [page.pageNumber]: 0 }));

      if (!settings.voiceEnabled) {
        const fallbackDuration = estimateReadingDuration(page.text);
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        startWordReveal(page.pageNumber, page.text, fallbackDuration, runId);
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
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        startWordReveal(page.pageNumber, page.text, fallbackDuration, runId);
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
      voice.onended = () => {
        if (narrationRunRef.current !== runId) {
          return;
        }
        const totalWords = page.text.trim().split(/\s+/).filter(Boolean).length;
        setRevealedWordCounts((current) => ({ ...current, [page.pageNumber]: totalWords }));
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
          startWordReveal(page.pageNumber, page.text, revealDuration, runId, voice);
        }
      } catch {
        const fallbackDuration = estimateReadingDuration(page.text);
        setRevealedPages((current) => ({ ...current, [page.pageNumber]: true }));
        startWordReveal(page.pageNumber, page.text, fallbackDuration, runId);
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
      startWordReveal,
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
    let timer: number | undefined;
    if (isOpen && settings.voiceEnabled) {
      timer = window.setTimeout(() => {
        void startPageNarration(activePageIndex, { autoAdvance: !hasCompletedFirstListen });
      }, 0);
    } else if (isOpen && !settings.voiceEnabled) {
      timer = window.setTimeout(() => {
        void startPageNarration(activePageIndex, { autoAdvance: !hasCompletedFirstListen });
      }, 0);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activePageIndex, hasCompletedFirstListen, isOpen, settings.voiceEnabled, startPageNarration]);

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
    narrationRunRef.current += 1;
    highestReachedRef.current = 0;
    hasCompletedFirstListenRef.current = false;
    setHighestReachedIndex(0);
    setHasCompletedFirstListen(false);
    setRevealedPages({});
    setIsOpen(true);
    setActivePageIndex(0);
    void playMusic();
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
        <AnimatePresence mode="wait">
          {!isOpen ? (
            <motion.section
              key="cover"
              initial={{ opacity: 0, y: 38, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="book-scene flex w-full justify-center"
            >
              <button
                type="button"
                onClick={handleOpen}
                className="leather-surface manuscript-cover group relative min-h-[34rem] w-full max-w-[26rem] overflow-hidden rounded-[2rem] border border-[#d9bd78]/25 p-8 text-center shadow-[0_45px_100px_rgba(0,0,0,0.68)] transition duration-700 hover:-translate-y-2 hover:shadow-[0_55px_120px_rgba(0,0,0,0.78)] sm:min-h-[39rem]"
              >
                <div className="absolute inset-y-0 left-8 w-2 bg-gradient-to-b from-transparent via-[#d9bd78]/45 to-transparent" />
                <div className="absolute inset-5 rounded-[1.5rem] border border-[#d9bd78]/30" />
                <div className="absolute inset-9 rounded-[1.1rem] border border-[#d9bd78]/15" />
                <div className="absolute left-1/2 top-[18%] h-24 w-24 -translate-x-1/2 rounded-full border border-[#d9bd78]/35 bg-black/20 shadow-[inset_0_4px_14px_rgba(255,240,180,0.16),0_18px_35px_rgba(0,0,0,0.45)]" />
                <div className="absolute left-1/2 top-[18%] h-10 w-10 -translate-x-1/2 translate-y-7 rotate-45 border border-[#d9bd78]/40 bg-[#d9bd78]/10 shadow-[0_0_30px_rgba(217,189,120,0.16)]" />
                <div className="relative z-10 flex h-full min-h-[29rem] flex-col items-center justify-between sm:min-h-[34rem]">
                  <div className="flex gap-3">
                    {coverMarks.map((mark) => (
                      <span
                        key={mark}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9bd78]/30 text-xs text-[#d9bd78]/80"
                      >
                        {mark}
                      </span>
                    ))}
                  </div>

                  <div>
                    <p className="font-title text-xs uppercase tracking-[0.42em] text-[#d9bd78]/80">Personal myth</p>
                    <h1 className="font-title mt-6 text-4xl leading-tight text-[#f8e8c5] sm:text-5xl">{book.title}</h1>
                    <p className="mx-auto mt-5 max-w-xs text-sm leading-7 text-[#bfc8d4]">{book.subtitle}</p>
                  </div>

                  <div>
                    <p className="mx-auto mb-5 max-w-xs text-sm italic leading-7 text-[#b6a481]">{book.narratorIntro}</p>
                    <span className="gold-button inline-flex rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.24em]">
                      Open the book
                    </span>
                  </div>
                </div>
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="pages"
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="w-full"
            >
              <div className="mb-5 text-center">
                <p className="font-title text-xs uppercase tracking-[0.36em] text-[#d9bd78]">
                  {activePage.chapter}
                </p>
                <h1 className="font-title mt-2 text-3xl text-[#f7ebce] sm:text-4xl">{book.title}</h1>
              </div>

              <div className="book-scene mx-auto flex w-full max-w-6xl justify-center overflow-visible">
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
                        revealedWordCount={revealedWordCounts[page.pageNumber]}
                      />
                    </div>,
                  ])}
                </HTMLFlipBook>
              </div>

              <div className="mx-auto mt-5 flex max-w-3xl items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={flipPrevious}
                  disabled={!canGoPrevious}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={flipNext}
                  disabled={!canGoNext}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next page
                </button>
              </div>

              {isGuidedFirstListen ? (
                <p className="mx-auto mt-3 max-w-2xl text-center text-xs uppercase tracking-[0.22em] text-[#9baabd]">
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
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
