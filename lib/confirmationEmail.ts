import {
  claimPaymentEmailSend,
  getBookByAccessToken,
  getBookById,
  markPaymentEmailFailed,
  markPaymentEmailSent,
  markPaymentEmailSkipped,
} from "@/lib/bookStore";
import { buildBookUnlockedEmailUrls, sendPaymentConfirmationEmail } from "@/lib/email";
import type { BookStatus } from "@/lib/types";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function isPaidBook(status: BookStatus) {
  return status === "paid" || status === "generating" || status === "ready";
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
    | "conditions_not_met"
    | "unexpected_error";
  recoveryEmailAvailable: boolean;
  error?: string;
};

export async function maybeSendPaymentConfirmationEmail(bookId: string): Promise<ConfirmationEmailResult> {
  try {
    const storedBook = await getBookById(bookId);
    if (!storedBook) {
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "book_not_found",
        recoveryEmailAvailable: false,
      };
    }

    const recipient = storedBook.email;
    const isPaid = isPaidBook(storedBook.status);
    const emailNotSent = !storedBook.payment_email_sent_at && storedBook.payment_email_status !== "sent";

    console.log("[PAYMENT_EMAIL_CHECK]", {
      bookId: storedBook.id,
      isPaid,
      hasRecipient: Boolean(recipient),
      paymentEmailStatus: storedBook.payment_email_status,
      paymentEmailSentAt: storedBook.payment_email_sent_at,
    });

    if (!isPaid || !recipient || !emailNotSent) {
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "conditions_not_met",
        recoveryEmailAvailable: Boolean(recipient) || storedBook.payment_email_status === "sent",
      };
    }

    if (storedBook.payment_email_sent_at || storedBook.payment_email_status === "sent") {
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
        error: errorMessage,
      });
      await markPaymentEmailFailed(claimedBook.id, errorMessage).catch((error) => {
        console.error("[PAYMENT_EMAIL_FAILED]", { bookId: claimedBook.id, error });
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
      console.error("[PAYMENT_EMAIL_FAILED]", { bookId: claimedBook.id, error });
    });
    console.log("[PAYMENT_EMAIL_SENT]", {
      bookId: claimedBook.id,
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
      error: message,
    });
    await markPaymentEmailFailed(bookId, message).catch((markError) => {
      console.error("[PAYMENT_EMAIL_FAILED]", { bookId, error: markError });
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
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: "book_not_found",
      recoveryEmailAvailable: false,
    };
  }

  if (!storedBook.email) {
    await markPaymentEmailSkipped(storedBook.id).catch((error) => {
      console.error("[PAYMENT_EMAIL_FAILED]", { bookId: storedBook.id, error });
    });
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: "missing_email",
      recoveryEmailAvailable: false,
    };
  }

  return maybeSendPaymentConfirmationEmail(storedBook.id);
}
