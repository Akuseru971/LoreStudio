import "server-only";

import { getBookById, isFinalReadyEmailAlreadySent, isFinalReadyEmailSendingInProgress, recoverStalePdfGeneration } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook, normalizeStoredBookImages } from "@/lib/book-images";
import { triggerFinalBookReadyEmailCheck } from "@/lib/finalBookReadyEmail";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { isPdfGenerationInProgress, resolvePdfDownload } from "@/lib/pdfDownload";
import type { PdfStatus } from "@/lib/types";

const autoTriggerTasks = new Set<string>();

const AWAIT_COMPLETION_SOURCES = new Set([
  "resume-stuck-books",
  "premium-image-complete",
  "generate-pdf-if-ready",
]);

export type TriggerPdfGenerationResult = {
  triggered: boolean;
  skipped: boolean;
  reason?: string;
  pdfStatus: PdfStatus;
};

function isPdfReady(book: { pdf_status: PdfStatus; pdf_storage_path: string | null }) {
  return book.pdf_status === "ready" || Boolean(book.pdf_storage_path);
}

async function sendFinalReadyEmailIfNeeded(bookId: string) {
  console.log("[FINAL_READY_EMAIL_TRIGGER_START]", { bookId });
  try {
    const latestBook = await getBookById(bookId);
    if (latestBook && isFinalReadyEmailAlreadySent(latestBook)) {
      console.log("[FINAL_READY_EMAIL_SKIPPED_ALREADY_SENT]", {
        bookId,
        pdfReadyEmailStatus: latestBook.pdf_ready_email_status,
        pdfReadyEmailSentAt: latestBook.pdf_ready_email_sent_at,
      });
      return { sent: false, reason: "already_sent" as const };
    }

    if (latestBook && isFinalReadyEmailSendingInProgress(latestBook)) {
      return { sent: false, reason: "already_claimed" as const };
    }

    const result = await triggerFinalBookReadyEmailCheck(bookId);
    if (result.sent) {
      const sentBook = await getBookById(bookId);
      console.log("[FINAL_READY_EMAIL_SENT]", {
        bookId,
        recipient: sentBook?.email || null,
      });
    }
    return result;
  } catch (error) {
    console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
    throw error;
  }
}

async function runPdfAutoTrigger(accessToken: string, bookId: string) {
  try {
    await recoverStalePdfGeneration(bookId);

    const result = await resolvePdfDownload(accessToken);
    console.log("[PDF_GENERATION_DONE]", { bookId, status: result.status });

    const latestBook = await getBookById(bookId);
    console.log("[PDF_STATUS_UPDATED]", {
      bookId,
      pdfStatus: latestBook?.pdf_status || null,
      pdfStoragePath: latestBook?.pdf_storage_path || null,
    });

    if (result.status === "ready" || latestBook?.pdf_storage_path) {
      await sendFinalReadyEmailIfNeeded(bookId);
      return;
    }

    if (result.status === "failed") {
      console.error("[PDF_AUTO_TRIGGER_FAILED]", {
        bookId,
        error: result.message || "PDF generation failed.",
      });
      return;
    }

    console.log("[PDF_AUTO_TRIGGER_DONE]", {
      bookId,
      pdfStatus: latestBook?.pdf_status || "generating",
      status: result.status,
    });
  } catch (error) {
    console.error("[PDF_AUTO_TRIGGER_FAILED]", {
      bookId,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

export async function triggerPdfGenerationIfReady(
  bookId: string,
  source: string,
): Promise<TriggerPdfGenerationResult> {
  console.log("[PDF_AUTO_TRIGGER_CALL_START]", { bookId, source });

  const book = await getBookById(bookId);
  if (!book) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "book_not_found",
    });
    return { triggered: false, skipped: true, reason: "book_not_found", pdfStatus: "not_started" };
  }

  const pdfStatus = book.pdf_status || "not_started";
  console.log("[PDF_AUTO_TRIGGER_PDF_STATUS_BEFORE]", {
    bookId,
    pdfStatus: book.pdf_status,
    pdfStoragePath: book.pdf_storage_path,
  });

  const normalized = getNormalizedImagesForStoredBook(book);

  if (!hasPremiumAccess(book.status)) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "premium_required",
    });
    return { triggered: false, skipped: true, reason: "premium_required", pdfStatus };
  }

  if (!normalized.allIllustrationsReady) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "images_not_ready",
    });
    return { triggered: false, skipped: true, reason: "images_not_ready", pdfStatus };
  }

  if (isFinalReadyEmailAlreadySent(book)) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "email_already_sent",
    });
    return {
      triggered: false,
      skipped: true,
      reason: "email_already_sent",
      pdfStatus: isPdfReady(book) ? "ready" : pdfStatus,
    };
  }

  if (isFinalReadyEmailSendingInProgress(book)) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "final_email_in_progress",
    });
    return {
      triggered: false,
      skipped: true,
      reason: "final_email_in_progress",
      pdfStatus: isPdfReady(book) ? "ready" : pdfStatus,
    };
  }

  if (isPdfReady(book)) {
    const { buildPdfGenerationContext, pdfNeedsPreviewCoverRecovery, resolvePreviewCoverUrlForPdf } =
      await import("@/lib/pdfBookPages");
    const normalizedImages = normalizeStoredBookImages(book);
    const context = buildPdfGenerationContext(book, normalizedImages);
    const coverImageSrc = await resolvePreviewCoverUrlForPdf(context);
    const needsCoverRecovery = book.pdf_storage_path
      ? await pdfNeedsPreviewCoverRecovery(book.pdf_storage_path, coverImageSrc)
      : false;

    if (!needsCoverRecovery) {
      console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
        bookId,
        reason: "pdf_ready_email_only",
      });
      await sendFinalReadyEmailIfNeeded(bookId).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
      });
      return { triggered: false, skipped: true, reason: "pdf_ready_email_only", pdfStatus: "ready" };
    }

    console.log("[PDF_COVER_RECOVERY_REQUESTED]", { bookId });
  }

  if (
    pdfStatus === "generating" &&
    !book.pdf_storage_path &&
    !isPdfGenerationInProgress(bookId) &&
    !autoTriggerTasks.has(bookId)
  ) {
    await recoverStalePdfGeneration(bookId);
  }

  const refreshedBook = await getBookById(bookId);
  const currentPdfStatus = refreshedBook?.pdf_status || pdfStatus;
  if (
    currentPdfStatus === "generating" &&
    (isPdfGenerationInProgress(bookId) || autoTriggerTasks.has(bookId))
  ) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "already_generating",
    });
    return {
      triggered: false,
      skipped: true,
      reason: "already_generating",
      pdfStatus: "generating",
    };
  }

  console.log("[PDF_AUTO_TRIGGER_START]", {
    bookId,
    source,
  });

  autoTriggerTasks.add(bookId);
  const accessToken = refreshedBook?.access_token || book.access_token;
  const task = runPdfAutoTrigger(accessToken, bookId).finally(() => {
    autoTriggerTasks.delete(bookId);
  });

  if (AWAIT_COMPLETION_SOURCES.has(source)) {
    await task;
  } else {
    void task;
  }

  const latestBook = await getBookById(bookId);
  return {
    triggered: true,
    skipped: false,
    pdfStatus: latestBook?.pdf_status || "generating",
  };
}
