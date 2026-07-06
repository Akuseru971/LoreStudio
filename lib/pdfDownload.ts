import "server-only";

import {
  claimPdfGeneration,
  createSignedPdfUrl,
  ensureBookPdf,
  getBookByAccessToken,
  markPdfFailed,
  markPdfWaitingForImages,
  mergeBookAssets,
  recoverStalePdfGeneration,
  repairPreviewCoverFromStorage,
} from "@/lib/bookStore";
import {
  areAllIllustrationsReady,
  getNormalizedImagesForStoredBook,
  hasFailedIllustrations,
  logPdfReadyCheck,
  normalizeStoredBookImages,
} from "@/lib/book-images";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export type PdfDownloadStatus = "ready" | "not_ready" | "generating_pdf" | "failed";

export type PdfDownloadResponse = {
  status: PdfDownloadStatus;
  downloadUrl?: string;
  message?: string;
  reason?: "illustrations_pending" | "illustrations_failed" | "premium_required";
};

const pdfGenerationTasks = new Map<string, Promise<void>>();

async function buildMergedBook(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const sourceBook = storedBook.full_book || storedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  return mergeBookAssets(sourceBook, storedBook.images, storedBook.audio);
}

async function runPdfGeneration(accessToken: string, bookId: string) {
  try {
    console.log("[PDF_GENERATION_START]", { bookId });
    const mergedBook = await buildMergedBook(accessToken);
    await ensureBookPdf(bookId, mergedBook);
    console.log("[PDF_GENERATION_DONE]", { bookId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed.";
    console.error("[PDF_GENERATION_FAILED]", { bookId, error: message });
    await markPdfFailed(bookId, message).catch((markError) => {
      console.error("[PDF_GENERATION_FAILED]", { bookId, error: markError });
    });
    throw error;
  }
}

function startPdfGeneration(accessToken: string, bookId: string) {
  const existingTask = pdfGenerationTasks.get(bookId);
  if (existingTask) {
    return existingTask;
  }

  const task = runPdfGeneration(accessToken, bookId)
    .catch((error) => {
      console.error("[PDF_GENERATION_ERROR]", error);
    })
    .finally(() => {
      pdfGenerationTasks.delete(bookId);
    });

  pdfGenerationTasks.set(bookId, task);
  return task;
}

export function isPdfGenerationInProgress(bookId: string) {
  return pdfGenerationTasks.has(bookId);
}

export async function resolvePdfDownload(accessToken: string): Promise<PdfDownloadResponse> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return { status: "failed", message: "Book not found." };
  }

  const activeBook = await repairPreviewCoverFromStorage(storedBook);

  if (!hasPremiumAccess(activeBook.status)) {
    return {
      status: "not_ready",
      reason: "premium_required",
      message: "Premium access is required.",
    };
  }

  const normalized = getNormalizedImagesForStoredBook(activeBook);

  if (!normalized.allIllustrationsReady) {
    logPdfReadyCheck(normalized.input, "download-pdf");
  }

  if (hasFailedIllustrations(normalized.input)) {
    return {
      status: "not_ready",
      reason: "illustrations_failed",
      message: "Some illustrations failed. Please retry generation.",
    };
  }

  if (!areAllIllustrationsReady(normalized.input)) {
    void markPdfWaitingForImages(activeBook.id).catch((error) => {
      console.warn("[PDF_STATUS_UPDATE_FAILED]", error);
    });

    return {
      status: "not_ready",
      reason: "illustrations_pending",
      message: "Illustrations are still being prepared.",
    };
  }

  if (activeBook.pdf_storage_path) {
    const { buildPdfGenerationContext, pdfNeedsPreviewCoverRecovery, resolvePreviewCoverUrlForPdf } =
      await import("@/lib/pdfBookPages");
    const normalizedImages = normalizeStoredBookImages(activeBook);
    const context = buildPdfGenerationContext(activeBook, normalizedImages);
    const coverImageSrc = await resolvePreviewCoverUrlForPdf(context);
    const needsCoverRecovery = await pdfNeedsPreviewCoverRecovery(activeBook.pdf_storage_path, coverImageSrc);

    if (!needsCoverRecovery) {
      const downloadUrl = await createSignedPdfUrl(activeBook.pdf_storage_path, 3600);
      return { status: "ready", downloadUrl };
    }

    console.log("[PDF_COVER_RECOVERY_REQUESTED]", { bookId: activeBook.id });
  }

  let currentBook = activeBook;
  if (currentBook.pdf_status === "generating" && !pdfGenerationTasks.has(currentBook.id)) {
    const recoveredBook = await recoverStalePdfGeneration(currentBook.id);
    currentBook = recoveredBook || currentBook;
    if (currentBook.pdf_storage_path) {
      const downloadUrl = await createSignedPdfUrl(currentBook.pdf_storage_path, 3600);
      return { status: "ready", downloadUrl };
    }
  }

  if (currentBook.pdf_status === "generating" || pdfGenerationTasks.has(currentBook.id)) {
    return {
      status: "generating_pdf",
      message: "PDF is being generated.",
    };
  }

  const claimedBook = await claimPdfGeneration(currentBook.id);
  if (!claimedBook) {
    const latestRawBook = await getBookByAccessToken(accessToken);
    const latestBook = latestRawBook ? await repairPreviewCoverFromStorage(latestRawBook) : null;
    if (latestBook?.pdf_storage_path) {
      const downloadUrl = await createSignedPdfUrl(latestBook.pdf_storage_path, 3600);
      return { status: "ready", downloadUrl };
    }

    if (latestBook?.pdf_status === "generating" || pdfGenerationTasks.has(currentBook.id)) {
      console.log("[PDF_GENERATION_SKIPPED_ALREADY_GENERATING]", { bookId: currentBook.id });
    } else if (latestBook?.pdf_storage_path) {
      console.log("[PDF_GENERATION_SKIPPED_ALREADY_READY]", { bookId: currentBook.id });
    }

    return {
      status: "generating_pdf",
      message: "PDF is being generated.",
    };
  }

  try {
    await startPdfGeneration(accessToken, claimedBook.id);
    const latestBook = await getBookByAccessToken(accessToken);
    if (latestBook?.pdf_storage_path) {
      const downloadUrl = await createSignedPdfUrl(latestBook.pdf_storage_path, 3600);
      return { status: "ready", downloadUrl };
    }

    return {
      status: "generating_pdf",
      message: "PDF is being generated.",
    };
  } catch {
    return {
      status: "failed",
      message: "PDF could not be generated.",
    };
  }
}
