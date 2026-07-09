"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  classifyPreviewNotifyEmailFailureReason,
  toPreviewNotifyAnalyticsProps,
  type PreviewNotifyAnalyticsContext,
} from "@/lib/previewNotifyAnalytics";
import { safeTrackClient } from "@/lib/safe-analytics-client";

type PreviewNotifyModalProps = {
  accessToken: string;
  isOpen: boolean;
  existingEmail?: string | null;
  getAnalyticsContext?: () => PreviewNotifyAnalyticsContext;
  onClose: () => void;
  onDismiss: () => void;
  onNotifyRequested: () => void;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function PreviewNotifyModal({
  accessToken,
  isOpen,
  existingEmail,
  getAnalyticsContext,
  onClose,
  onDismiss,
  onNotifyRequested,
}: PreviewNotifyModalProps) {
  const [step, setStep] = useState<"offer" | "email" | "confirmed">("offer");
  const [email, setEmail] = useState(existingEmail?.trim() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailStartedTrackedRef = useRef(false);
  const waitClickedTrackedRef = useRef(false);

  const trackPreviewNotifyEvent = useCallback(
    (eventName: string, extra?: PreviewNotifyAnalyticsContext) => {
      safeTrackClient(eventName, toPreviewNotifyAnalyticsProps({
        ...(getAnalyticsContext?.() ?? {}),
        ...extra,
      }));
    },
    [getAnalyticsContext],
  );

  const trackEmailStartedOnce = useCallback(() => {
    if (emailStartedTrackedRef.current) {
      return;
    }

    emailStartedTrackedRef.current = true;
    trackPreviewNotifyEvent("preview_notify_email_started");
  }, [trackPreviewNotifyEvent]);

  const submitNotification = useCallback(
    async (emailToUse: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/preview-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            email: emailToUse.trim(),
          }),
        });

        const data = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to save your notification request.");
        }

        setStep("confirmed");
        trackPreviewNotifyEvent("preview_notify_email_submitted", {
          hasPreviewNotificationEmail: true,
        });
        onNotifyRequested();
      } catch (submitError) {
        const message =
          submitError instanceof Error ? submitError.message : "Unable to save your notification request.";
        setError(message);
        trackPreviewNotifyEvent("preview_notify_email_failed", {
          reason: classifyPreviewNotifyEmailFailureReason(message),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [accessToken, onNotifyRequested, trackPreviewNotifyEvent],
  );

  const handleNotifyClick = useCallback(() => {
    trackEmailStartedOnce();

    const trimmedEmail = (email || existingEmail || "").trim();
    if (trimmedEmail && isValidEmail(trimmedEmail)) {
      void submitNotification(trimmedEmail);
      return;
    }

    setStep("email");
  }, [email, existingEmail, submitNotification, trackEmailStartedOnce]);

  const handleEmailSubmit = useCallback(() => {
    trackEmailStartedOnce();

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.");
      trackPreviewNotifyEvent("preview_notify_email_failed", { reason: "invalid_email" });
      return;
    }

    void submitNotification(trimmedEmail);
  }, [email, submitNotification, trackEmailStartedOnce, trackPreviewNotifyEvent]);

  const handleDismiss = useCallback(() => {
    if (!waitClickedTrackedRef.current) {
      waitClickedTrackedRef.current = true;
      trackPreviewNotifyEvent("preview_notify_wait_clicked");
    }

    onDismiss();
    onClose();
  }, [onClose, onDismiss, trackPreviewNotifyEvent]);

  const handleConfirmedClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="preview-notify-backdrop"
          className="fixed inset-0 z-[125] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close notification offer"
            className="absolute inset-0 bg-[#02030a]/65 backdrop-blur-[2px]"
            onClick={step === "confirmed" ? handleConfirmedClose : handleDismiss}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-notify-title"
            className="glass-panel relative z-10 w-full max-w-md rounded-[1.75rem] border border-[#d9bd78]/18 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="relative rounded-[1.75rem] p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(217,189,120,0.1),transparent_58%)]" />

              <div className="relative">
                {step === "confirmed" ? (
                  <>
                    <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">
                      Notification set
                    </p>
                    <h2 id="preview-notify-title" className="font-cover-title mt-3 text-xl leading-tight text-[#f7ebce]">
                      Perfect — we&apos;ll email you when your preview is ready.
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-[#9baabd]">
                      You can keep this page open, or return later using the link in your email.
                    </p>
                    <button
                      type="button"
                      onClick={handleConfirmedClose}
                      className="gold-button mt-6 w-full rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-[0.22em]"
                    >
                      Continue waiting
                    </button>
                  </>
                ) : step === "email" ? (
                  <>
                    <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">
                      Stay informed
                    </p>
                    <h2 id="preview-notify-title" className="font-cover-title mt-3 text-xl leading-tight text-[#f7ebce]">
                      Where should we send your preview link?
                    </h2>
                    <label className="mt-5 block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#9baabd]">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onFocus={trackEmailStartedOnce}
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
                        onClick={() => void handleEmailSubmit()}
                        disabled={isSubmitting}
                        className="gold-button rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70"
                      >
                        {isSubmitting ? "Saving..." : "Notify me by email"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDismiss}
                        disabled={isSubmitting}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/25 hover:text-[#f7ebce]"
                      >
                        I&apos;ll wait here
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-title text-[0.62rem] uppercase tracking-[0.34em] text-[#d9bd78]/80">
                      While you wait
                    </p>
                    <h2 id="preview-notify-title" className="font-cover-title mt-3 text-xl leading-tight text-[#f7ebce]">
                      Your legend is being illustrated.
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-[#9baabd]">This usually takes around 3 minutes.</p>
                    <p className="mt-3 text-sm leading-7 text-[#b8c2d0]">
                      Want us to email you when your preview is ready?
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => void handleNotifyClick()}
                        disabled={isSubmitting}
                        className="gold-button rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70"
                      >
                        {isSubmitting ? "Saving..." : "Notify me by email"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDismiss}
                        disabled={isSubmitting}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#9baabd] transition hover:border-[#d9bd78]/25 hover:text-[#f7ebce]"
                      >
                        I&apos;ll wait here
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
