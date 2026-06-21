import type { PageImageState, PdfStatus } from "@/lib/types";
import {
  areAllIllustrationsReady,
  getReadyIllustrationCount,
  hasFailedIllustrations,
  type BookImagesInput,
} from "@/lib/book-images";

export type PdfAvailability =
  | "locked_unpaid"
  | "waiting_for_illustrations"
  | "illustrations_failed"
  | "generating_pdf"
  | "ready"
  | "failed";

export {
  areAllIllustrationsReady,
  getReadyIllustrationCount,
  hasFailedIllustrations,
  hasGeneratingIllustrations,
} from "@/lib/book-images";

export function countReadyIllustrations(images: Record<string, PageImageState>) {
  return getReadyIllustrationCount({ images });
}

export function resolvePdfAvailability({
  isPremium,
  images,
  pdfStatus,
  isDownloadingPdf = false,
}: {
  isPremium: boolean;
  images: Record<string, PageImageState>;
  pdfStatus?: PdfStatus;
  isDownloadingPdf?: boolean;
}): PdfAvailability {
  const imageInput: BookImagesInput = { images };

  if (!isPremium) {
    return "locked_unpaid";
  }

  if (hasFailedIllustrations(imageInput)) {
    return "illustrations_failed";
  }

  if (!areAllIllustrationsReady(imageInput)) {
    return "waiting_for_illustrations";
  }

  if (isDownloadingPdf || pdfStatus === "generating") {
    return "generating_pdf";
  }

  if (pdfStatus === "failed") {
    return "failed";
  }

  return "ready";
}

export function getPdfButtonLabel(availability: PdfAvailability) {
  switch (availability) {
    case "locked_unpaid":
      return "Unlock PDF";
    case "waiting_for_illustrations":
      return "PDF preparing...";
    case "illustrations_failed":
      return "Retry illustrations before PDF";
    case "generating_pdf":
      return "Creating PDF...";
    case "failed":
      return "Retry PDF";
    case "ready":
    default:
      return "Download PDF";
  }
}

export function getPdfStatusMessage(availability: PdfAvailability) {
  switch (availability) {
    case "locked_unpaid":
      return "Unlock the full story to download your illustrated PDF.";
    case "waiting_for_illustrations":
      return "Your illustrated PDF will be available once all illustrations are ready.";
    case "illustrations_failed":
      return "Some illustrations failed. Please retry generation.";
    case "generating_pdf":
      return "Creating your illustrated PDF...";
    case "failed":
      return "PDF generation failed. Please try again.";
    case "ready":
    default:
      return "Your PDF is ready to download.";
  }
}

export function isPdfDownloadReady(availability: PdfAvailability) {
  return availability === "ready";
}
