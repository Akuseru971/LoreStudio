import {
  claimPaymentEmailSend,
  getBookByAccessToken,
  getBookById,
  markPaymentEmailFailed,
  markPaymentEmailSent,
  markPaymentEmailSkipped,
} from "@/lib/bookStore";
import { buildBookUnlockedEmailUrls, sendPaymentConfirmationEmail } from "@/lib/email";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import type { StoredBook } from "@/lib/types";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function getPaymentEmailTracking(book: StoredBook) {
  const usesPaymentFields =
    Boolean(book.payment_email_sent_at) ||
    (book.payment_email_status && book.payment_email_status !== "not_started");

  if (usesPaymentFields) {
    return {
      status: book.payment_email_status,
      sentAt: book.payment_email_sent_at,
      error: book.payment_email_error,
      legacyConfirmationFields: false,
    };
  }

  return {
    status: book.confirmation_email_status,
    sentAt: book.confirmation_email_sent_at,
    error: book.confirmation_email_error,
    legacyConfirmationFields: true,
  };
}

export type ConfirmationEmailResult = {
  sent: boolean;
  skipped: boolean;
  failed: boolean;
  reason:
    | "sent"
    | "send_failed"
    | "already_sent"
    | "missing_email"
    | "already_claimed"
    | "book_not_found"
    | "book_not_paid"
    | "conditions_not_met"
    | "unexpected_error";
  recoveryEmailAvailable: boolean;
  error?: string;
};

export async function sendPaymentConfirmationEmailIfNeeded(
  bookId: string,
): Promise<ConfirmationEmailResult> {
  try {
    const storedBook = await getBookById(bookId);
    if (!storedBook) {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId,
        reason: "book_not_found",
      });
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "book_not_found",
        recoveryEmailAvailable: false,
      };
    }

    const recipient = storedBook.email;
    const isPaid = hasPremiumAccess(storedBook.status);
    const tracking = getPaymentEmailTracking(storedBook);
    const emailNotSent = !tracking.sentAt && tracking.status !== "sent";

    console.log("[PAYMENT_CONFIRMATION_EMAIL_CHECK]", {
      bookId: storedBook.id,
      isPaid,
      hasRecipient: Boolean(recipient),
      paymentEmailStatus: tracking.status,
      paymentEmailSentAt: tracking.sentAt,
      legacyConfirmationFields: Boolean(tracking.legacyConfirmationFields),
    });

    if (!isPaid) {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId: storedBook.id,
        reason: "book_not_paid",
        status: storedBook.status,
      });
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "book_not_paid",
        recoveryEmailAvailable: Boolean(recipient),
      };
    }

    if (!recipient) {
      await markPaymentEmailSkipped(storedBook.id).catch((error) => {
        console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
          bookId: storedBook.id,
          reason: "mark_skipped_failed",
          error,
        });
      });
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId: storedBook.id,
        reason: "missing_email",
      });
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "missing_email",
        recoveryEmailAvailable: false,
      };
    }

    if (!emailNotSent) {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ALREADY_SENT]", {
        bookId: storedBook.id,
        paymentEmailStatus: tracking.status,
        paymentEmailSentAt: tracking.sentAt,
      });
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "already_sent",
        recoveryEmailAvailable: true,
      };
    }

    const claimedBook = await claimPaymentEmailSend(storedBook.id);
    if (!claimedBook) {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ALREADY_SENT]", {
        bookId: storedBook.id,
        reason: "already_claimed",
        paymentEmailStatus: tracking.status,
        paymentEmailSentAt: tracking.sentAt,
      });
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "already_claimed",
        recoveryEmailAvailable: true,
      };
    }

    const urls = buildBookUnlockedEmailUrls(claimedBook.access_token);
    const result = await sendPaymentConfirmationEmail({
      to: recipient,
      bookUrl: urls.bookUrl,
      idempotencyKey: `payment-confirmation/${claimedBook.id}`,
    });

    if (!result.sent) {
      const errorMessage = result.error || "Unable to send payment confirmation email.";
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId: claimedBook.id,
        recipient,
        reason: "send_failed",
        error: errorMessage,
      });
      await markPaymentEmailFailed(claimedBook.id, errorMessage).catch((error) => {
        console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
          bookId: claimedBook.id,
          reason: "mark_failed",
          error,
        });
      });
      return {
        sent: false,
        skipped: false,
        failed: true,
        reason: "send_failed",
        recoveryEmailAvailable: false,
        error: errorMessage,
      };
    }

    await markPaymentEmailSent(claimedBook.id).catch((error) => {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId: claimedBook.id,
        reason: "mark_sent_failed",
        error,
      });
    });
    console.log("[PAYMENT_CONFIRMATION_EMAIL_SENT]", {
      bookId: claimedBook.id,
      recipient,
    });
    return {
      sent: true,
      skipped: false,
      failed: false,
      reason: "sent",
      recoveryEmailAvailable: true,
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
      bookId,
      reason: "unexpected_error",
      error: message,
    });
    await markPaymentEmailFailed(bookId, message).catch((markError) => {
      console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
        bookId,
        reason: "mark_failed",
        error: markError,
      });
    });
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: "unexpected_error",
      recoveryEmailAvailable: false,
      error: message,
    };
  }
}

export async function maybeSendPaymentConfirmationEmail(
  bookId: string,
  _source = "unknown",
): Promise<ConfirmationEmailResult> {
  return sendPaymentConfirmationEmailIfNeeded(bookId);
}

export async function sendConfirmationEmailIfNeeded(accessToken: string): Promise<ConfirmationEmailResult> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    console.log("[PAYMENT_CONFIRMATION_EMAIL_ERROR]", {
      bookId: "unknown",
      reason: "book_not_found",
    });
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: "book_not_found",
      recoveryEmailAvailable: false,
    };
  }

  return sendPaymentConfirmationEmailIfNeeded(storedBook.id);
}
