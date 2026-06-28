import "server-only";

import {
  claimPdfReadyEmailSend,
  getBookById,
  isFinalReadyEmailAlreadySent,
  isFinalReadyEmailSendingInProgress,
  markPdfReadyEmailFailed,
  markPdfReadyEmailSent,
} from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { buildBookUnlockedEmailUrls, buildFinalReadyEmailPdfUrl, sendFinalBookReadyEmail } from "@/lib/email";
import { hasPremiumAccess } from "@/lib/paymentVerification";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

export type FinalBookReadyEmailResult = {
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

function isPdfReady(book: { pdf_status: string; pdf_storage_path: string | null }) {
  return book.pdf_status === "ready" || Boolean(book.pdf_storage_path);
}

function logFinalReadyEmailCheck(
  book: NonNullable<Awaited<ReturnType<typeof getBookById>>>,
  bookId: string,
) {
  console.log("[FINAL_READY_EMAIL_CHECK]", {
    bookId,
    pdfReadyEmailStatus: book.pdf_ready_email_status,
    pdfReadyEmailSentAt: book.pdf_ready_email_sent_at,
    hasPdf: Boolean(book.pdf_storage_path),
  });
}

export async function maybeSendFinalBookReadyEmail(bookId: string): Promise<FinalBookReadyEmailResult> {
  try {
    let book = await getBookById(bookId);
    if (!book) {
      return { sent: false, reason: "book_not_found" };
    }

    logFinalReadyEmailCheck(book, bookId);

    if (isFinalReadyEmailAlreadySent(book)) {
      console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
        bookId,
        pdfReadyEmailStatus: book.pdf_ready_email_status,
        pdfReadyEmailSentAt: book.pdf_ready_email_sent_at,
      });
      return { sent: false, reason: "already_sent" };
    }

    if (isFinalReadyEmailSendingInProgress(book)) {
      console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
        bookId,
        pdfReadyEmailStatus: book.pdf_ready_email_status,
        pdfReadyEmailSentAt: book.pdf_ready_email_sent_at,
        reason: "sending_in_progress",
      });
      return { sent: false, reason: "already_claimed" };
    }

    const isPaid = hasPremiumAccess(book.status);
    const normalized = getNormalizedImagesForStoredBook(book);
    const allImagesReady = normalized.allIllustrationsReady;
    const pdfReady = isPdfReady(book);

    if (!isPaid || !allImagesReady || !pdfReady) {
      return { sent: false, reason: "conditions_not_met" };
    }

    if (!book.email) {
      return { sent: false, reason: "missing_email" };
    }

    const claimedBook = await claimPdfReadyEmailSend(bookId);
    if (!claimedBook) {
      book = await getBookById(bookId);
      if (book && isFinalReadyEmailAlreadySent(book)) {
        console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
          bookId,
          pdfReadyEmailStatus: book.pdf_ready_email_status,
          pdfReadyEmailSentAt: book.pdf_ready_email_sent_at,
        });
        return { sent: false, reason: "already_sent" };
      }

      return { sent: false, reason: "already_claimed" };
    }

    console.log("[FINAL_READY_EMAIL_MARK_SENDING]", { bookId });

    book = await getBookById(bookId);
    if (!book) {
      return { sent: false, reason: "book_not_found" };
    }

    logFinalReadyEmailCheck(book, bookId);

    if (isFinalReadyEmailAlreadySent(book)) {
      console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
        bookId,
        pdfReadyEmailStatus: book.pdf_ready_email_status,
        pdfReadyEmailSentAt: book.pdf_ready_email_sent_at,
      });
      return { sent: false, reason: "already_sent" };
    }

    const recipient = claimedBook.email!;
    console.log("[FINAL_READY_EMAIL_PROVIDER_CALL_START]", {
      bookId,
      recipient,
    });

    const urls = buildBookUnlockedEmailUrls(claimedBook.access_token);
    const pdfUrl = buildFinalReadyEmailPdfUrl(claimedBook.id, claimedBook.access_token);
    const result = await sendFinalBookReadyEmail({
      to: recipient,
      bookUrl: urls.bookUrl,
      pdfUrl,
      idempotencyKey: `final-book-ready/${claimedBook.id}`,
    });

    if (!result.sent) {
      const errorMessage = result.error || "Unable to send final book ready email.";
      console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error: errorMessage });
      await markPdfReadyEmailFailed(claimedBook.id, errorMessage).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
      });
      return { sent: false, reason: "send_failed", error: errorMessage };
    }

    await markPdfReadyEmailSent(claimedBook.id);
    console.log("[FINAL_READY_EMAIL_SENT]", { bookId, recipient });
    return { sent: true, reason: "sent" };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error: message });

    const latestBook = await getBookById(bookId);
    if (latestBook && isFinalReadyEmailAlreadySent(latestBook)) {
      console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
        bookId,
        pdfReadyEmailStatus: latestBook.pdf_ready_email_status,
        pdfReadyEmailSentAt: latestBook.pdf_ready_email_sent_at,
      });
      return { sent: false, reason: "already_sent" };
    }

    if (latestBook?.pdf_ready_email_status === "sending") {
      return { sent: false, reason: "already_claimed", error: message };
    }

    await markPdfReadyEmailFailed(bookId, message).catch((markError) => {
      console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error: markError });
    });
    return { sent: false, reason: "unexpected_error", error: message };
  }
}

export async function triggerFinalBookReadyEmailCheck(bookId: string) {
  console.log("[PDF_READY_TRIGGER_FINAL_EMAIL_CHECK]", { bookId });
  return maybeSendFinalBookReadyEmail(bookId);
}
