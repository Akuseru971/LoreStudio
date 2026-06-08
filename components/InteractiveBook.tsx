"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AudioControls from "@/components/AudioControls";
import BookPage from "@/components/BookPage";
import ResultActions from "@/components/ResultActions";
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
  const [audioCache, setAudioCache] = useState<Record<number, string | null>>({});
  const [imageCache, setImageCache] = useState<Record<number, string | null>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>({
    musicEnabled: true,
    voiceEnabled: true,
  });

  const flipRef = useRef<PageFlipHandle | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const pagesWithImages = book.pages.map((page) => ({
    ...page,
    imageUrl: imageCache[page.pageNumber] || page.imageUrl,
  }));
  const activePage = pagesWithImages[activePageIndex] || pagesWithImages[0];
  const isFinalPage = isOpen && activePageIndex >= book.pages.length - 1;

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

  const playNarration = useCallback(
    async (pageIndex: number) => {
      const page = book.pages[pageIndex];
      if (!page || !settings.voiceEnabled) {
        return;
      }

      const audioUrl = await fetchAudioForPage(page.pageNumber, page.text);
      if (!audioUrl) {
        return;
      }

      if (!voiceRef.current) {
        voiceRef.current = new Audio();
      }

      voiceRef.current.pause();
      voiceRef.current.src = audioUrl;
      voiceRef.current.volume = 0.82;

      try {
        await voiceRef.current.play();
      } catch {
        // The user can still press replay if the browser blocks delayed playback.
      }
    },
    [book.pages, fetchAudioForPage, settings.voiceEnabled],
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
        void playNarration(activePageIndex);
      }, 0);
    } else if (!settings.voiceEnabled) {
      voiceRef.current?.pause();
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activePageIndex, isOpen, playNarration, settings.voiceEnabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const page = book.pages[activePageIndex];
    if (!page) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchImageForPage(page.pageNumber);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePageIndex, book.pages, fetchImageForPage, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const orderedPages = [
      ...book.pages.slice(activePageIndex),
      ...book.pages.slice(0, activePageIndex),
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
  }, [activePageIndex, book.pages, fetchImageForPage, isOpen]);

  function handleOpen() {
    setIsOpen(true);
    setActivePageIndex(0);
    void playMusic();
    void playNarration(0);
  }

  function handleFlip(event: { data?: number }) {
    const physicalPage = typeof event.data === "number" ? event.data : 0;
    const nextIndex = Math.floor(Math.max(physicalPage, 0) / 2);
    setActivePageIndex(Math.min(nextIndex, book.pages.length - 1));
  }

  function flipPrevious() {
    const previousSpread = Math.max(activePageIndex - 1, 0);
    flipRef.current?.pageFlip()?.flip(previousSpread * 2, "top");
  }

  function flipNext() {
    const nextSpread = Math.min(activePageIndex + 1, book.pages.length - 1);
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
                className="leather-surface group relative min-h-[34rem] w-full max-w-[26rem] overflow-hidden rounded-[2rem] border border-[#d9bd78]/25 p-8 text-center shadow-[0_45px_100px_rgba(0,0,0,0.68)] transition duration-700 hover:-translate-y-2 hover:shadow-[0_55px_120px_rgba(0,0,0,0.78)] sm:min-h-[39rem]"
              >
                <div className="absolute inset-y-0 left-8 w-2 bg-gradient-to-b from-transparent via-[#d9bd78]/45 to-transparent" />
                <div className="absolute inset-5 rounded-[1.5rem] border border-[#d9bd78]/30" />
                <div className="absolute inset-9 rounded-[1.1rem] border border-[#d9bd78]/15" />
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
                  useMouseEvents
                  swipeDistance={30}
                  showPageCorners
                  disableFlipByClick={false}
                  onFlip={handleFlip}
                >
                  {pagesWithImages.flatMap((page, index) => [
                    <div key={`${page.pageNumber}-image`} className="page">
                      <BookPage
                        page={page}
                        side="image"
                        isActive={index === activePageIndex}
                        isImageLoading={Boolean(loadingImages[page.pageNumber])}
                      />
                    </div>,
                    <div key={`${page.pageNumber}-text`} className="page">
                      <BookPage page={page} side="text" isActive={index === activePageIndex} />
                    </div>,
                  ])}
                </HTMLFlipBook>
              </div>

              <div className="mx-auto mt-5 flex max-w-3xl items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={flipPrevious}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce]"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={flipNext}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c9d3df] transition hover:border-[#d9bd78]/45 hover:text-[#f7ebce]"
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
                onReplayVoice={() => void playNarration(activePageIndex)}
              />

              {isFinalPage ? <ResultActions onReset={onReset} /> : null}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
