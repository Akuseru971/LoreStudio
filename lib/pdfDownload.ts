import {
  claimPdfGeneration,
  createSignedPdfUrl,
  ensureBookPdf,
  getBookByAccessToken,
  markPdfFailed,
  markPdfWaitingForImages,
  mergeBookAssets,
} from "@/lib/bookStore";
import {
  areAllIllustrationsReady,
  getNormalizedImagesForStoredBook,
  hasFailedIllustrations,
  logPdfReadyCheck,
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
    const mergedBook = await buildMergedBook(accessToken);
    await ensureBookPdf(bookId, mergedBook);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed.";
    await markPdfFailed(bookId, message).catch((markError) => {
      console.error("[PDF_GENERATION_ERROR]", markError);
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

export async function resolvePdfDownload(accessToken: string): Promise<PdfDownloadResponse> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return { status: "failed", message: "Book not found." };
  }

  if (!hasPremiumAccess(storedBook.status)) {
    return {
      status: "not_ready",
      reason: "premium_required",
      message: "Premium access is required.",
    };
  }

  const normalized = getNormalizedImagesForStoredBook(storedBook);

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
    void markPdfWaitingForImages(storedBook.id).catch((error) => {
      console.warn("[PDF_STATUS_UPDATE_FAILED]", error);
    });

    return {
      status: "not_ready",
      reason: "illustrations_pending",
      message: "Illustrations are still being prepared.",
    };
  }

  if (storedBook.pdf_storage_path) {
    const downloadUrl = await createSignedPdfUrl(storedBook.pdf_storage_path, 3600);
    return { status: "ready", downloadUrl };
  }

  if (storedBook.pdf_status === "generating" || pdfGenerationTasks.has(storedBook.id)) {
    return {
      status: "generating_pdf",
      message: "PDF is being generated.",
    };
  }

  const claimedBook = await claimPdfGeneration(storedBook.id);
  if (!claimedBook) {
    const latestBook = await getBookByAccessToken(accessToken);
    if (latestBook?.pdf_storage_path) {
      const downloadUrl = await createSignedPdfUrl(latestBook.pdf_storage_path, 3600);
      return { status: "ready", downloadUrl };
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
