import {
  claimPaymentEmailSend,
  getBookByAccessToken,
  getBookById,
  markPaymentEmailFailed,
  markPaymentEmailSent,
  markPaymentEmailSkipped,
} from "@/lib/bookStore";
import { buildBookUnlockedEmailUrls, logPaymentEmailEnvCheck, sendPaymentConfirmationEmail } from "@/lib/email";
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

function logPaymentEmailSkipped(bookId: string, reason: string, details: Record<string, unknown>) {
  console.log("[PAYMENT_EMAIL_SKIPPED]", {
    bookId,
    reason,
    ...details,
  });
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

export async function maybeSendPaymentConfirmationEmail(
  bookId: string,
  source = "unknown",
): Promise<ConfirmationEmailResult> {
  console.log("[PAYMENT_EMAIL_DIAG_START]", {
    source,
    bookId,
    timestamp: new Date().toISOString(),
  });
  logPaymentEmailEnvCheck();

  try {
    const storedBook = await getBookById(bookId);
    if (!storedBook) {
      logPaymentEmailSkipped(bookId, "book_not_found", {
        isPaid: false,
        hasRecipient: false,
        paymentEmailStatus: null,
        paymentEmailSentAt: null,
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

    console.log("[PAYMENT_EMAIL_CHECK]", {
      bookId: storedBook.id,
      isPaid,
      hasRecipient: Boolean(recipient),
      recipient,
      paymentEmailStatus: tracking.status,
      paymentEmailSentAt: tracking.sentAt,
      legacyConfirmationFields: Boolean(tracking.legacyConfirmationFields),
    });

    if (!isPaid) {
      logPaymentEmailSkipped(bookId, "book_not_paid", {
        isPaid,
        hasRecipient: Boolean(recipient),
        paymentEmailStatus: tracking.status,
        paymentEmailSentAt: tracking.sentAt,
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
        console.error("[PAYMENT_EMAIL_FAILED]", { bookId: storedBook.id, recipient: null, error });
      });
      logPaymentEmailSkipped(bookId, "missing_email", {
        isPaid,
        hasRecipient: false,
        paymentEmailStatus: tracking.status,
        paymentEmailSentAt: tracking.sentAt,
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
      logPaymentEmailSkipped(bookId, "already_sent", {
        isPaid,
        hasRecipient: true,
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
      logPaymentEmailSkipped(bookId, "already_claimed", {
        isPaid,
        hasRecipient: true,
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

    console.log("[PAYMENT_EMAIL_SEND_START]", {
      bookId: claimedBook.id,
      recipient,
    });

    const urls = buildBookUnlockedEmailUrls(claimedBook.access_token);
    const result = await sendPaymentConfirmationEmail({
      to: recipient,
      bookUrl: urls.bookUrl,
      idempotencyKey: `payment-confirmation/${claimedBook.id}`,
    });

    if (!result.sent) {
      const errorMessage = result.error || "Unable to send payment confirmation email.";
      console.error("[PAYMENT_EMAIL_FAILED]", {
        bookId: claimedBook.id,
        recipient,
        error: errorMessage,
      });
      await markPaymentEmailFailed(claimedBook.id, errorMessage).catch((error) => {
        console.error("[PAYMENT_EMAIL_FAILED]", { bookId: claimedBook.id, recipient, error });
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
      console.error("[PAYMENT_EMAIL_FAILED]", { bookId: claimedBook.id, recipient, error });
    });
    console.log("[PAYMENT_EMAIL_SENT]", {
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
    console.error("[PAYMENT_EMAIL_FAILED]", {
      bookId,
      recipient: null,
      error: message,
    });
    await markPaymentEmailFailed(bookId, message).catch((markError) => {
      console.error("[PAYMENT_EMAIL_FAILED]", { bookId, recipient: null, error: markError });
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

export async function sendConfirmationEmailIfNeeded(accessToken: string): Promise<ConfirmationEmailResult> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    logPaymentEmailSkipped("unknown", "book_not_found", {
      isPaid: false,
      hasRecipient: false,
      paymentEmailStatus: null,
      paymentEmailSentAt: null,
    });
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: "book_not_found",
      recoveryEmailAvailable: false,
    };
  }

  return maybeSendPaymentConfirmationEmail(storedBook.id, "sendConfirmationEmailIfNeeded");
}
