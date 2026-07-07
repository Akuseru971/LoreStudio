import "server-only";

import {
  claimPreviewReadyEmailSend,
  getBookById,
  isPreviewReadyEmailAlreadySent,
  isPreviewReadyEmailSendingInProgress,
  markPreviewReadyEmailFailed,
  markPreviewReadyEmailSent,
} from "@/lib/bookStore";
import { areFreeIllustrationsReady } from "@/lib/freeImages";
import { buildBookUnlockedEmailUrls, sendFreePreviewReadyEmail } from "@/lib/email";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { isSupabaseSchemaError } from "@/lib/supabaseErrors";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

export type FreePreviewReadyEmailResult = {
  sent: boolean;
  reason?:
    | "sent"
    | "send_failed"
    | "already_sent"
    | "missing_email"
    | "already_claimed"
    | "conditions_not_met"
    | "book_not_found"
    | "unexpected_error";
  error?: string;
};

export async function maybeSendFreePreviewReadyEmail(bookId: string): Promise<FreePreviewReadyEmailResult> {
  try {
    let book = await getBookById(bookId);
    if (!book) {
      return { sent: false, reason: "book_not_found" };
    }

    if (isPreviewReadyEmailAlreadySent(book)) {
      console.log("[PREVIEW_READY_EMAIL_SKIPPED_ALREADY_SENT]", { bookId });
      return { sent: false, reason: "already_sent" };
    }

    if (isPreviewReadyEmailSendingInProgress(book)) {
      return { sent: false, reason: "already_claimed" };
    }

    if (hasPremiumAccess(book.status)) {
      return { sent: false, reason: "conditions_not_met" };
    }

    if (!book.preview_notify_requested) {
      return { sent: false, reason: "conditions_not_met" };
    }

    if (!areFreeIllustrationsReady(book)) {
      return { sent: false, reason: "conditions_not_met" };
    }

    const recipient = book.preview_notification_email?.trim();
    if (!recipient) {
      return { sent: false, reason: "missing_email" };
    }

    const claimedBook = await claimPreviewReadyEmailSend(bookId);
    if (!claimedBook) {
      book = await getBookById(bookId);
      if (book && isPreviewReadyEmailAlreadySent(book)) {
        console.log("[PREVIEW_READY_EMAIL_SKIPPED_ALREADY_SENT]", { bookId });
        return { sent: false, reason: "already_sent" };
      }

      return { sent: false, reason: "already_claimed" };
    }

    book = await getBookById(bookId);
    if (!book) {
      return { sent: false, reason: "book_not_found" };
    }

    if (isPreviewReadyEmailAlreadySent(book)) {
      console.log("[PREVIEW_READY_EMAIL_SKIPPED_ALREADY_SENT]", { bookId });
      return { sent: false, reason: "already_sent" };
    }

    const result = await sendFreePreviewReadyEmail({
      to: recipient,
      bookUrl: buildBookUnlockedEmailUrls(claimedBook.access_token).bookUrl,
      idempotencyKey: `free-preview-ready/${claimedBook.id}`,
    });

    if (!result.sent) {
      const errorMessage = result.error || "Unable to send preview ready email.";
      console.error("[PREVIEW_READY_EMAIL_FAILED]", { bookId, error: errorMessage });
      await markPreviewReadyEmailFailed(claimedBook.id, errorMessage).catch((error) => {
        console.error("[PREVIEW_READY_EMAIL_FAILED]", { bookId, error });
      });
      return { sent: false, reason: "send_failed", error: errorMessage };
    }

    await markPreviewReadyEmailSent(claimedBook.id);
    console.log("[PREVIEW_READY_EMAIL_SENT]", { bookId, email: recipient });
    return { sent: true, reason: "sent" };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error("[PREVIEW_READY_EMAIL_FAILED]", { bookId, error: message });

    const latestBook = await getBookById(bookId);
    if (latestBook && isPreviewReadyEmailAlreadySent(latestBook)) {
      console.log("[PREVIEW_READY_EMAIL_SKIPPED_ALREADY_SENT]", { bookId });
      return { sent: false, reason: "already_sent" };
    }

    if (latestBook?.preview_ready_email_status === "sending") {
      return { sent: false, reason: "already_claimed", error: message };
    }

    await markPreviewReadyEmailFailed(bookId, message).catch((markError) => {
      console.error("[PREVIEW_READY_EMAIL_FAILED]", { bookId, error: markError });
    });

    if (isSupabaseSchemaError(error)) {
      const fallbackBook = await getBookById(bookId);
      const recipient = fallbackBook?.preview_notification_email?.trim();
      if (
        fallbackBook &&
        recipient &&
        !hasPremiumAccess(fallbackBook.status) &&
        fallbackBook.preview_notify_requested &&
        areFreeIllustrationsReady(fallbackBook)
      ) {
        console.warn("[PREVIEW_READY_EMAIL_SCHEMA_FALLBACK]", {
          bookId,
          action: "send_without_db_tracking",
        });
        const result = await sendFreePreviewReadyEmail({
          to: recipient,
          bookUrl: buildBookUnlockedEmailUrls(fallbackBook.access_token).bookUrl,
          idempotencyKey: `free-preview-ready/${fallbackBook.id}`,
        });
        if (result.sent) {
          console.log("[PREVIEW_READY_EMAIL_SENT]", { bookId, email: recipient, schemaFallback: true });
          return { sent: true, reason: "sent" };
        }
      }
    }

    return { sent: false, reason: "unexpected_error", error: message };
  }
}

export async function triggerFreePreviewReadyEmailCheck(bookId: string) {
  return maybeSendFreePreviewReadyEmail(bookId);
}
