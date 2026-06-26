import {
  claimConfirmationEmailSend,
  getBookByAccessToken,
  getBookById,
  markConfirmationEmailFailed,
  markConfirmationEmailSent,
  markConfirmationEmailSkipped,
} from "@/lib/bookStore";
import { buildBookUnlockedEmailUrls, sendBookUnlockedEmail } from "@/lib/email";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
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

    console.log("[PAYMENT_EMAIL_CHECK]", {
      bookId: storedBook.id,
      status: storedBook.status,
      paymentEmailStatus: storedBook.confirmation_email_status,
      paymentEmailSentAt: storedBook.confirmation_email_sent_at,
      hasCustomerEmail: Boolean(storedBook.email),
    });

    if (storedBook.confirmation_email_sent_at || storedBook.confirmation_email_status === "sent") {
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "already_sent",
        recoveryEmailAvailable: true,
      };
    }

    if (!storedBook.email) {
      await markConfirmationEmailSkipped(storedBook.id).catch((error) => {
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

    const claimedBook = await claimConfirmationEmailSend(storedBook.id);
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
    const result = await sendBookUnlockedEmail({
      to: claimedBook.email!,
      bookUrl: urls.bookUrl,
      pdfUrl: urls.pdfUrl,
      mp3Url: urls.mp3Url,
      idempotencyKey: `book-unlocked/${claimedBook.id}`,
    });

    if (!result.sent) {
      const errorMessage = result.error || "Unable to send confirmation email.";
      console.error("[PAYMENT_EMAIL_FAILED]", {
        bookId: claimedBook.id,
        error: errorMessage,
      });
      await markConfirmationEmailFailed(claimedBook.id, errorMessage).catch((error) => {
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

    await markConfirmationEmailSent(claimedBook.id).catch((error) => {
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

  return maybeSendPaymentConfirmationEmail(storedBook.id);
}
