import "server-only";

import { getBookById } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { triggerFinalBookReadyEmailCheck } from "@/lib/finalBookReadyEmail";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { isPdfGenerationInProgress, resolvePdfDownload } from "@/lib/pdfDownload";
import type { PdfStatus } from "@/lib/types";

const autoTriggerTasks = new Set<string>();

export type TriggerPdfGenerationResult = {
  triggered: boolean;
  skipped: boolean;
  reason?: string;
  pdfStatus: PdfStatus;
};

async function runPdfAutoTrigger(accessToken: string, bookId: string) {
  try {
    const result = await resolvePdfDownload(accessToken);
    const latestBook = await getBookById(bookId);
    const pdfStatus = latestBook?.pdf_status || (result.status === "ready" ? "ready" : "generating");

    console.log("[PDF_AUTO_TRIGGER_DONE]", {
      bookId,
      pdfStatus,
    });

    if (result.status === "ready" || latestBook?.pdf_storage_path) {
      await triggerFinalBookReadyEmailCheck(bookId).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
      });
    }
  } catch (error) {
    console.error("[PDF_AUTO_TRIGGER_ERROR]", {
      bookId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function triggerPdfGenerationIfReady(
  bookId: string,
  source: string,
): Promise<TriggerPdfGenerationResult> {
  const book = await getBookById(bookId);
  if (!book) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "book_not_found",
    });
    return { triggered: false, skipped: true, reason: "book_not_found", pdfStatus: "not_started" };
  }

  const pdfStatus = book.pdf_status || "not_started";
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

  if (book.pdf_storage_path && pdfStatus === "ready") {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: "already_ready",
    });
    void triggerFinalBookReadyEmailCheck(bookId).catch((error) => {
      console.error("[FINAL_READY_EMAIL_FAILED]", { bookId, error });
    });
    return { triggered: false, skipped: true, reason: "already_ready", pdfStatus: "ready" };
  }

  if (pdfStatus === "generating" || isPdfGenerationInProgress(bookId) || autoTriggerTasks.has(bookId)) {
    console.log("[PDF_AUTO_TRIGGER_SKIPPED]", {
      bookId,
      reason: pdfStatus === "generating" ? "already_generating" : "trigger_in_progress",
    });
    return {
      triggered: false,
      skipped: true,
      reason: pdfStatus === "generating" ? "already_generating" : "trigger_in_progress",
      pdfStatus: "generating",
    };
  }

  console.log("[PDF_AUTO_TRIGGER_START]", {
    bookId,
    source,
  });

  autoTriggerTasks.add(bookId);
  void runPdfAutoTrigger(book.access_token, bookId).finally(() => {
    autoTriggerTasks.delete(bookId);
  });

  return { triggered: true, skipped: false, pdfStatus: "generating" };
}
