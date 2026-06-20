import {
  claimPdfGeneration,
  createSignedPdfUrl,
  ensureBookPdf,
  getBookByAccessToken,
  markPdfFailed,
  markPdfWaitingForImages,
  mergeBookAssets,
} from "@/lib/bookStore";
import { areBookImagesPending } from "@/lib/imageStatus";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { triggerPremiumImageGeneration } from "@/lib/premiumImages";

export type PdfDownloadStatus = "ready" | "preparing_images" | "generating_pdf" | "failed";

export type PdfDownloadResponse = {
  status: PdfDownloadStatus;
  downloadUrl?: string;
  message?: string;
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
    await markPdfFailed(bookId);
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
    return { status: "failed", message: "Premium access is required." };
  }

  if (storedBook.pdf_storage_path) {
    const downloadUrl = await createSignedPdfUrl(storedBook.pdf_storage_path, 3600);
    return { status: "ready", downloadUrl };
  }

  if (areBookImagesPending(storedBook)) {
    await markPdfWaitingForImages(storedBook.id);
    triggerPremiumImageGeneration(accessToken);
    return {
      status: "preparing_images",
      message: "Illustrations are being prepared.",
    };
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
