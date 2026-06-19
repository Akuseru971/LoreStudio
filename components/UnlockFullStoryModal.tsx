"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LoreBook } from "@/lib/types";

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
  const [email, setEmail] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    setIsRedirecting(true);
    setError(null);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          email: email.trim() || undefined,
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

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="unlock-modal-backdrop"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
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
            aria-labelledby="unlock-full-story-title"
            aria-describedby="unlock-full-story-description"
            className="glass-panel unlock-story-modal relative z-10 m-0 w-full max-w-md rounded-[1.75rem] border border-[#d9bd78]/22 p-0 text-left shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <div className="relative overflow-hidden rounded-[1.75rem] p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,189,120,0.14),transparent_55%)]" />
              <div className="relative">
                <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
                  The chronicle deepens
                </p>
                <h2 id="unlock-full-story-title" className="font-cover-title mt-3 text-2xl leading-tight text-[#f7ebce]">
                  Unlock the rest of your legend
                </h2>
                <p id="unlock-full-story-description" className="mt-4 text-sm leading-7 text-[#b8c2d0]">
                  The final pages reveal what this connection truly means. Unlock the complete interactive book now and
                  download your PDF version instantly after payment.
                </p>

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#9baabd]">Email for delivery</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
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
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isRedirecting}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/30 hover:text-[#e8dcc0] disabled:opacity-60"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
