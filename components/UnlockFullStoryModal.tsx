"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SampleProductPreview from "@/components/SampleProductPreview";
import { safeTrackClient } from "@/lib/safe-analytics-client";
import type { LoreBook } from "@/lib/types";
import { cn } from "@/lib/utils";

const CAROUSEL_SLIDES = [
  {
    title: "Your full legend includes",
    text: "",
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

const FIRST_SLIDE_BENEFITS = [
  "8 illustrated chapters",
  "A cinematic PDF book",
  "Your premium cover included",
  "Delivered by email",
  "Secure payment by Stripe",
] as const;

const LAUNCH_PRICE = "$2.99";

const UNLOCK_BENEFITS = [
  "8 illustrated story chapters",
  "A cinematic PDF book with your cover",
  "Premium continuation of your preview",
  "Delivered by email after payment",
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
  const [email, setEmail] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalSlideTrackedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setCarouselIndex(0);
      setEmail("");
      setError(null);
      setIsRedirecting(false);
      finalSlideTrackedRef.current = false;
      safeTrackClient("unlock_carousel_started", { source: "unlock_modal" });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (carouselIndex === 1) {
      safeTrackClient("unlock_carousel_slide_viewed", { slide: 2 });
    }

    if (carouselIndex === 2 && !finalSlideTrackedRef.current) {
      finalSlideTrackedRef.current = true;
      safeTrackClient("unlock_carousel_slide_viewed", { slide: 3 });
      safeTrackClient("unlock_final_slide_viewed", { source: "unlock_modal" });
      safeTrackClient("unlock_carousel_completed", { source: "unlock_modal" });
    }
  }, [carouselIndex, isOpen]);

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
  const isFirstSlide = carouselIndex === 0;
  const slide = CAROUSEL_SLIDES[carouselIndex];

  const handleCarouselNext = () => {
    setCarouselIndex((current) => current + 1);
  };

  const handleFinalCheckout = () => {
    void handleUnlock();
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
            aria-labelledby="unlock-carousel-title"
            aria-describedby="unlock-carousel-description"
            className="glass-panel unlock-story-modal relative z-10 m-0 w-full max-w-md rounded-[1.75rem] border border-[#d9bd78]/22 p-0 text-left shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <div
              className={cn(
                "relative rounded-[1.75rem] p-6 sm:p-7",
                isLastSlide
                  ? "unlock-carousel-final-shell max-sm:flex max-sm:max-h-[min(88dvh,calc(100dvh-1.5rem))] max-sm:flex-col max-sm:overflow-hidden max-sm:p-5"
                  : "max-h-[min(90dvh,720px)] overflow-y-auto",
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,189,120,0.14),transparent_55%)]" />
              <div className={cn("relative", isLastSlide && "max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col")}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`unlock-carousel-${carouselIndex}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className={cn(isLastSlide && "unlock-carousel-final-slide max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col")}
                  >
                    <div className={cn(isLastSlide && "unlock-carousel-final-slide-body max-sm:min-h-0 max-sm:flex-1 max-sm:overflow-y-auto")}>
                      <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
                        {carouselIndex + 1} / {CAROUSEL_SLIDES.length}
                      </p>
                      <h2
                        id="unlock-carousel-title"
                        className={cn(
                          "font-cover-title mt-3 text-2xl leading-tight text-[#f7ebce]",
                          isLastSlide && "max-sm:mt-2 max-sm:text-xl",
                          isFirstSlide && "max-sm:mt-2 max-sm:text-xl",
                        )}
                      >
                        {slide.title}
                      </h2>
                      {isFirstSlide ? (
                        <ul
                          id="unlock-carousel-description"
                          className="unlock-carousel-first-benefits mt-4 space-y-2.5 max-sm:mt-3 max-sm:space-y-2"
                        >
                          {FIRST_SLIDE_BENEFITS.map((benefit) => (
                            <li
                              key={benefit}
                              className="flex items-start gap-2.5 text-left text-sm leading-6 text-[#c9d3df] max-sm:text-[0.82rem] max-sm:leading-5"
                            >
                              <span className="mt-0.5 shrink-0 text-[#d9bd78]" aria-hidden="true">
                                ✓
                              </span>
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p
                          id="unlock-carousel-description"
                          className={cn(
                            "mt-4 text-sm leading-7 text-[#b8c2d0]",
                            isLastSlide && "max-sm:mt-2 max-sm:text-[0.8rem] max-sm:leading-6",
                          )}
                        >
                          {slide.text}
                        </p>
                      )}

                      {isLastSlide ? (
                        <>
                          <label className="mt-5 block max-sm:mt-3">
                            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#9baabd] max-sm:mb-1.5 max-sm:text-[0.68rem]">
                              Email for delivery
                            </span>
                            <input
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder="you@example.com"
                              autoComplete="email"
                              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[#f7ebce] outline-none transition focus:border-[#d9bd78]/40 max-sm:px-3.5 max-sm:py-2.5"
                            />
                          </label>

                          <div className="unlock-carousel-final-samples max-sm:mt-3">
                            <SampleProductPreview
                              title="Preview what you'll receive"
                              subtitle="Listen to a sample chapter and open a sample PDF before unlocking your full legend."
                              disabled={isRedirecting}
                              prominent
                              audioHeading="Listen sample audio"
                              pdfButtonLabel="Preview final PDF example"
                            />
                          </div>

                          <div className="unlock-offer-trust-block mt-5 rounded-2xl border border-[#d9bd78]/18 bg-black/24 px-4 py-4 max-sm:mt-3 max-sm:px-3.5 max-sm:py-3">
                            <h3 className="font-title text-[0.68rem] uppercase tracking-[0.22em] text-[#d9bd78]/90">
                              What you unlock
                            </h3>
                            <ul className="mt-3 space-y-2 max-sm:mt-2.5 max-sm:space-y-1.5">
                              {UNLOCK_BENEFITS.map((benefit) => (
                                <li key={benefit} className="flex items-start gap-2.5 text-left text-sm leading-6 text-[#c9d3df] max-sm:text-[0.8rem] max-sm:leading-5">
                                  <span className="mt-0.5 shrink-0 text-[#d9bd78]" aria-hidden="true">
                                    ✓
                                  </span>
                                  <span>{benefit}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-4 border-t border-white/6 pt-3 text-center text-[0.65rem] tracking-[0.06em] text-[#8f9aac] max-sm:mt-3 max-sm:pt-2.5">
                              Secure payment by Stripe
                            </p>
                          </div>

                          {error ? (
                            <p className="mt-4 rounded-xl border border-red-400/25 bg-red-950/30 px-4 py-3 text-sm text-red-200 max-sm:mt-3 max-sm:px-3 max-sm:py-2.5 max-sm:text-xs">
                              {error}
                            </p>
                          ) : null}
                        </>
                      ) : null}

                      <div
                        className={cn(
                          "mt-6 flex items-center justify-center gap-2",
                          isLastSlide && "max-sm:mt-4",
                          isFirstSlide && "max-sm:mt-5",
                        )}
                      >
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
                    </div>

                    <div
                      className={cn(
                        "mt-6",
                        isLastSlide && "unlock-carousel-final-slide-cta max-sm:mt-0",
                      )}
                    >
                      {isLastSlide ? (
                        <>
                          <button
                            type="button"
                            onClick={handleFinalCheckout}
                            disabled={isRedirecting}
                            className="gold-button w-full rounded-2xl px-5 py-3.5 text-xs font-bold tracking-[0.22em] normal-case disabled:cursor-wait disabled:opacity-70"
                          >
                            {isRedirecting ? (
                              "Opening secure checkout..."
                            ) : (
                              <span className="flex flex-col items-center gap-1">
                                <span className="tracking-[0.08em]">Unlock my full legend</span>
                                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[#2a1c0b]/72">
                                  Launch price
                                </span>
                                <span className="font-cover-title text-[1.35rem] leading-none tracking-[0.05em] text-[#2a1c0b]/88">
                                  {LAUNCH_PRICE}
                                </span>
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={onClose}
                            disabled={isRedirecting}
                            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/30 hover:text-[#e8dcc0] disabled:opacity-60 max-sm:mt-2 max-sm:py-2.5"
                          >
                            Not now
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCarouselNext}
                          className="gold-button w-full rounded-2xl px-5 py-3.5 text-xs font-bold uppercase tracking-[0.22em]"
                        >
                          Next
                        </button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
