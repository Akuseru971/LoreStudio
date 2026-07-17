"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const KOFI_URL = "https://ko-fi.com/loreoflegends";

type ReplaySupportModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ReplaySupportModal({ open, onClose }: ReplaySupportModalProps) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="replay-support-modal-root"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <button
            type="button"
            className="replay-support-modal-backdrop"
            aria-label="Close support dialog"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="replay-support-modal glass-panel"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
          >
            <p id={titleId} className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/85">
              One Chronicle Per Day
            </p>
            <motion.div
              id={descriptionId}
              className="mt-4 space-y-3 text-sm leading-7 text-[#d9c599]"
            >
              <p>Today&apos;s free chronicle has already been completed.</p>
              <p>Want to unlock a second mystery? Support Lore of Legends with a coffee on Ko-fi.</p>
            </motion.div>
            <div className="mt-6 flex flex-col items-center gap-4">
              <a
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="replay-support-kofi-link"
              >
                <img
                  src="/images/kofi-buy-me-a-coffee.svg"
                  alt="Support Lore of Legends on Ko-fi"
                  width={216}
                  height={48}
                  className="replay-support-kofi-image"
                />
              </a>
              <button
                ref={closeButtonRef}
                type="button"
                className="daily-mystery-secondary-link"
                onClick={onClose}
              >
                Maybe tomorrow
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
