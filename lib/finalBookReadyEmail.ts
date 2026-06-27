import "server-only";

import {
  claimPdfReadyEmailSend,
  getBookById,
  markPdfReadyEmailFailed,
  markPdfReadyEmailSent,
} from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { buildBookUnlockedEmailUrls, sendFinalBookReadyEmail } from "@/lib/email";
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

export async function maybeSendFinalBookReadyEmail(bookId: string): Promise<FinalBookReadyEmailResult> {
  try {
    const book = await getBookById(bookId);
    if (!book) {
      return { sent: false, reason: "book_not_found" };
    }

    const isPaid = hasPremiumAccess(book.status);
    const normalized = getNormalizedImagesForStoredBook(book);
    const allImagesReady = normalized.allIllustrationsReady;
    const pdfReady = isPdfReady(book);
    const emailNotSent = !book.pdf_ready_email_sent_at && book.pdf_ready_email_status !== "sent";

    console.log("[FINAL_READY_EMAIL_CHECK]", {
      bookId,
      status: book.status,
      readyImagesCount: normalized.readyIllustrationCount,
      allImagesReady,
      pdfStatus: book.pdf_status,
      hasPdfPath: Boolean(book.pdf_storage_path),
      emailStatus: book.pdf_ready_email_status,
      emailSentAt: book.pdf_ready_email_sent_at,
    });

    if (!isPaid || !allImagesReady || !pdfReady || !emailNotSent) {
      return { sent: false, reason: "conditions_not_met" };
    }

    if (!book.email) {
      return { sent: false, reason: "missing_email" };
    }

    const claimedBook = await claimPdfReadyEmailSend(bookId);
    if (!claimedBook) {
      return { sent: false, reason: "already_claimed" };
    }

    console.log("[FINAL_READY_EMAIL_SEND_START]", { bookId });

    const urls = buildBookUnlockedEmailUrls(claimedBook.access_token);
    const result = await sendFinalBookReadyEmail({
      to: claimedBook.email!,
      bookUrl: urls.bookUrl,
      pdfUrl: urls.pdfUrl,
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

    await markPdfReadyEmailSent(claimedBook.id).catch((error) => {
      console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
    });
    console.log("[FINAL_READY_EMAIL_SENT]", { bookId, recipient: claimedBook.email });
    return { sent: true, reason: "sent" };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error: message });
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
