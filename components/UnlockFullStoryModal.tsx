"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { safeTrackClient } from "@/lib/safe-analytics-client";
import type { LoreBook } from "@/lib/types";
import { cn } from "@/lib/utils";

const CAROUSEL_SLIDES = [
  {
    title: "Unlock your full legend",
    text: "Continue your story with all 8 illustrated pages, including the premium chapters hidden in the preview.",
  },
  {
    title: "Receive a cinematic PDF",
    text: "Your complete legend is turned into a premium downloadable PDF book, ready to keep and share.",
  },
  {
    title: "Ready in a few minutes",
    text: "After payment, your full book is prepared automatically. This usually takes around 5 to 15 minutes.",
  },
] as const;

type UnlockFullStoryModalProps = {
  book: LoreBook;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function UnlockFullStoryModal({
  accessToken,
  isOpen,
  onClose,
}: UnlockFullStoryModalProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [email, setEmail] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCarouselIndex(0);
      setShowEmailStep(false);
      setEmail("");
      setError(null);
      setIsRedirecting(false);
      safeTrackClient("unlock_carousel_started", { source: "unlock_modal" });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || showEmailStep) {
      return;
    }

    if (carouselIndex === 1) {
      safeTrackClient("unlock_carousel_slide_viewed", { slide: 2 });
    }

    if (carouselIndex === 2) {
      safeTrackClient("unlock_carousel_slide_viewed", { slide: 3 });
    }
  }, [carouselIndex, isOpen, showEmailStep]);

  const handleUnlock = useCallback(async () => {
    setIsRedirecting(true);
    setError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      safeTrackClient("unlock_email_submitted", { source: "unlock_modal" });
    }

    safeTrackClient("checkout_started", { source: "unlock_modal" });

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          email: trimmedEmail || undefined,
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to open the payment page.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to open the payment page.");
      setIsRedirecting(false);
    }
  }, [accessToken, email]);

  const isLastSlide = carouselIndex === CAROUSEL_SLIDES.length - 1;
  const slide = CAROUSEL_SLIDES[carouselIndex];

  const handleCarouselNext = () => {
    if (isLastSlide) {
      safeTrackClient("unlock_carousel_completed", { source: "unlock_modal" });
      setShowEmailStep(true);
      return;
    }

    setCarouselIndex((current) => current + 1);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="unlock-modal-backdrop"
          className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close unlock offer"
            className="absolute inset-0 bg-[#02030a]/78 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={showEmailStep ? "unlock-full-story-title" : "unlock-carousel-title"}
            aria-describedby={showEmailStep ? "unlock-full-story-description" : "unlock-carousel-description"}
            className="glass-panel unlock-story-modal relative z-10 m-0 w-full max-w-md rounded-[1.75rem] border border-[#d9bd78]/22 p-0 text-left shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <div className="relative max-h-[min(90dvh,720px)] overflow-y-auto rounded-[1.75rem] p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,189,120,0.14),transparent_55%)]" />
              <div className="relative">
                <AnimatePresence mode="wait">
                  {showEmailStep ? (
                    <motion.div
                      key="unlock-email-step"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
                        The chronicle deepens
                      </p>
                      <h2 id="unlock-full-story-title" className="font-cover-title mt-3 text-2xl leading-tight text-[#f7ebce]">
                        Unlock the rest of your legend
                      </h2>
                      <p id="unlock-full-story-description" className="mt-4 text-sm leading-7 text-[#b8c2d0]">
                        The final pages reveal what this connection truly means. Unlock the complete interactive book now
                        and download your PDF version instantly after payment.
                      </p>

                      <label className="mt-5 block">
                        <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#9baabd]">
                          Email for delivery
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[#f7ebce] outline-none transition focus:border-[#d9bd78]/40"
                        />
                      </label>

                      {error ? (
                        <p className="mt-4 rounded-xl border border-red-400/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                          {error}
                        </p>
                      ) : null}

                      <div className="mt-6 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => void handleUnlock()}
                          disabled={isRedirecting}
                          className="gold-button rounded-2xl px-5 py-3.5 text-xs font-bold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70"
                        >
                          {isRedirecting ? "Opening secure checkout..." : "Unlock full book"}
                        </button>
                        <p className="text-center text-[0.68rem] text-[#8f9aac]">Secure payment powered by Stripe.</p>
                        <button
                          type="button"
                          onClick={onClose}
                          disabled={isRedirecting}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/30 hover:text-[#e8dcc0] disabled:opacity-60"
                        >
                          Not now
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`unlock-carousel-${carouselIndex}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
                        {carouselIndex + 1} / {CAROUSEL_SLIDES.length}
                      </p>
                      <h2 id="unlock-carousel-title" className="font-cover-title mt-3 text-2xl leading-tight text-[#f7ebce]">
                        {slide.title}
                      </h2>
                      <p id="unlock-carousel-description" className="mt-4 text-sm leading-7 text-[#b8c2d0]">
                        {slide.text}
                      </p>

                      <div className="mt-6 flex items-center justify-center gap-2">
                        {CAROUSEL_SLIDES.map((_, dotIndex) => (
                          <span
                            key={dotIndex}
                            aria-hidden="true"
                            className={cn(
                              "h-2 rounded-full transition-all",
                              dotIndex === carouselIndex ? "w-6 bg-[#d9bd78]" : "w-2 bg-[#d9bd78]/30",
                            )}
                          />
                        ))}
                      </div>

                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={handleCarouselNext}
                          className={cn(
                            "gold-button w-full rounded-2xl px-5 py-3.5 text-xs font-bold tracking-[0.22em]",
                            isLastSlide ? "normal-case" : "uppercase",
                          )}
                        >
                          {isLastSlide ? (
                            <span className="flex flex-col items-center gap-1.5">
                              <span className="tracking-[0.08em]">Unlock my full legend</span>
                              <span className="font-cover-title text-[1.35rem] leading-none tracking-[0.05em] text-[#2a1c0b]/88">
                                €3.99
                              </span>
                            </span>
                          ) : (
                            "Next"
                          )}
                        </button>
                        {isLastSlide ? (
                          <p className="mt-3 text-center text-[0.68rem] text-[#8f9aac]">
                            Secure payment by Stripe · Delivered by email in 5–15 min
                          </p>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
