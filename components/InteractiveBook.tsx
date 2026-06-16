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

const MOBILE_BREAKPOINT = 768;

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

function useIsMobileBook() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

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
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>({
    musicEnabled: true,
    voiceEnabled: true,
  });

  const isMobile = useIsMobileBook();
  const flipRef = useRef<PageFlipHandle | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const narrationRunRef = useRef(0);
  const touchStartX = useRef<number | null>(null);

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
  const canGoPrevious = activePageIndex > 0;
  const canGoNext = activePageIndex < illustratedPages.length - 1;

  const coverMarks = useMemo(() => ["I", "II", "III", "IV"], []);

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
      voiceRef.current?.pause();
    };
  }, []);

  const goToSpread = useCallback(
    (pageIndex: number) => {
      const nextIndex = Math.min(Math.max(pageIndex, 0), illustratedPages.length - 1);
      setActivePageIndex(nextIndex);
      if (!isMobile) {
        flipRef.current?.pageFlip()?.flip(nextIndex * 2, "top");
      }
    },
    [illustratedPages.length, isMobile],
  );

  const startPageNarration = useCallback(
    async (pageIndex: number) => {
      const page = illustratedPages[pageIndex];
      if (!page) {
        return;
      }

      narrationRunRef.current += 1;
      const runId = narrationRunRef.current;
      voiceRef.current?.pause();

      if (!settings.voiceEnabled) {
        return;
      }

      const audioUrl = await fetchAudioForPage(page.pageNumber, page.text);
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
      voice.onended = null;
      voice.onerror = null;

      try {
        await voice.play();
      } catch {
        voiceRef.current?.pause();
      }
    },
    [fetchAudioForPage, illustratedPages, settings.voiceEnabled],
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
      void startPageNarration(activePageIndex);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePageIndex, isOpen, startPageNarration]);

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

  const goToPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= illustratedPages.length) {
        return;
      }

      narrationRunRef.current += 1;
      voiceRef.current?.pause();
      goToSpread(pageIndex);
    },
    [goToSpread, illustratedPages.length],
  );

  function handleOpen() {
    if (bookState !== "closed") {
      return;
    }
    narrationRunRef.current += 1;
    setBookState("opening");
    setActivePageIndex(0);
    void playMusic();
    window.setTimeout(() => {
      setBookState("open");
    }, 1700);
  }

  function handleFlip(event: { data?: number }) {
    const physicalPage = typeof event.data === "number" ? event.data : 0;
    const nextIndex = Math.floor(Math.max(physicalPage, 0) / 2);
    if (nextIndex === activePageIndex) {
      return;
    }

    narrationRunRef.current += 1;
    voiceRef.current?.pause();
    setActivePageIndex(nextIndex);
  }

  function flipPrevious() {
    if (!canGoPrevious) {
      return;
    }
    goToPage(activePageIndex - 1);
  }

  function flipNext() {
    if (!canGoNext) {
      return;
    }
    goToPage(activePageIndex + 1);
  }

  const handleMobileTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleMobileTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const startX = touchStartX.current;
      touchStartX.current = null;
      if (startX === null) {
        return;
      }

      const endX = event.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      if (Math.abs(delta) < 48) {
        return;
      }

      if (delta < 0 && canGoNext) {
        goToPage(activePageIndex + 1);
      } else if (delta > 0 && canGoPrevious) {
        goToPage(activePageIndex - 1);
      }
    },
    [activePageIndex, canGoNext, canGoPrevious, goToPage],
  );

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
        narrationRunRef.current += 1;
        voiceRef.current?.pause();
      } else if (isOpen) {
        void startPageNarration(activePageIndex);
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
              animate={
                bookState === "opening"
                  ? { opacity: 1, y: -10, rotateX: 0, scale: 1.07 }
                  : { opacity: 1, y: 0, rotateX: 0, scale: 1 }
              }
              exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
              transition={{ duration: bookState === "opening" ? 1.45 : 0.85, ease: "easeOut" }}
              className="book-scene flex w-full justify-center"
            >
              <motion.button
                type="button"
                onClick={handleOpen}
                disabled={bookState === "opening"}
                animate={
                  bookState === "opening"
                    ? {
                        rotateY: -13,
                        boxShadow:
                          "0 65px 140px rgba(0,0,0,0.82), 0 0 90px rgba(71,132,211,0.22), inset -24px 0 38px rgba(0,0,0,0.58)",
                      }
                    : { rotateY: 0 }
                }
                transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
                className="leather-surface manuscript-cover group relative min-h-[34rem] w-full max-w-[26rem] overflow-hidden rounded-[2rem] border border-[#d9bd78]/25 p-8 text-center shadow-[0_45px_100px_rgba(0,0,0,0.68)] transition duration-700 hover:-translate-y-2 hover:shadow-[0_55px_120px_rgba(0,0,0,0.78)] sm:min-h-[39rem]"
              >
                <motion.div
                  className="pointer-events-none absolute inset-y-8 right-0 z-20 w-10 bg-[#7eb6ff]/20 blur-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: bookState === "opening" ? [0, 0.95, 0.4] : 0 }}
                  transition={{ duration: 1.45, ease: "easeInOut" }}
                />
                <motion.div
                  className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_70%_50%,rgba(126,182,255,0.22),transparent_34%)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: bookState === "opening" ? 1 : 0 }}
                  transition={{ duration: 1.2 }}
                />
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
                      {bookState === "opening" ? "The archive awakens" : "Open the book"}
                    </span>
                  </div>
                </div>
              </motion.button>
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

              {isMobile ? (
                <div className="mobile-book-shell mx-auto flex w-full flex-col items-center gap-4">
                  <div
                    className="mobile-book-page"
                    onTouchStart={handleMobileTouchStart}
                    onTouchEnd={handleMobileTouchEnd}
                  >
                    <BookPage
                      page={activePage}
                      side="combined"
                      isActive
                      isImageLoading={Boolean(loadingImages[activePage.pageNumber])}
                    />
                  </div>

                  <nav className="mobile-book-nav" aria-label="Book page navigation">
                    <button
                      type="button"
                      className="mobile-book-nav-btn"
                      onClick={flipPrevious}
                      disabled={!canGoPrevious}
                      aria-label="Previous page"
                    >
                      ← Prev
                    </button>
                    <span className="mobile-book-nav-indicator" aria-live="polite">
                      Page {activePageIndex + 1} / {illustratedPages.length}
                    </span>
                    <button
                      type="button"
                      className="mobile-book-nav-btn"
                      onClick={flipNext}
                      disabled={!canGoNext}
                      aria-label="Next page"
                    >
                      Next →
                    </button>
                  </nav>
                </div>
              ) : (
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
                        />
                      </div>,
                      <div key={`${page.pageNumber}-text`} className="page">
                        <BookPage
                          page={page}
                          side="text"
                          isActive={index === activePageIndex}
                        />
                      </div>,
                    ])}
                  </HTMLFlipBook>
                </div>
              )}

              <div className="mx-auto mt-5 hidden max-w-3xl items-center justify-center gap-3 md:flex">
                <button
                  type="button"
                  onClick={flipPrevious}
                  disabled={!canGoPrevious}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <span className="text-xs uppercase tracking-[0.18em] text-[#9baabd]">
                  Page {activePageIndex + 1} / {illustratedPages.length}
                </span>
                <button
                  type="button"
                  onClick={flipNext}
                  disabled={!canGoNext}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next page
                </button>
              </div>

              <AudioControls
                settings={settings}
                musicAvailable={musicAvailable}
                isLoadingVoice={isLoadingVoice}
                onToggleMusic={toggleMusic}
                onToggleVoice={toggleVoice}
                onReplayVoice={() => void startPageNarration(activePageIndex)}
              />

              {isFinalPage ? <ResultActions onReset={onReset} /> : null}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
