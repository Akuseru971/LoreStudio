import { NextResponse } from "next/server";
import {
  findFreeBooksNeedingPreviewResume,
  findPaidBooksNeedingPdfOrFinalEmail,
  findPaidBooksWithIncompletePremiumGeneration,
  getBookByAccessToken,
  getBookById,
  isFinalReadyEmailAlreadySent,
  isFinalReadyEmailSendingInProgress,
} from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import {
  generateNextPremiumImage,
  getMissingPremiumImagePages,
  getPremiumGenerationStatus,
  recoverStalePremiumImages,
} from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { resumeFreePreviewGeneration } from "@/lib/resumeFreePreviewGeneration";
import { triggerPdfGenerationIfReady } from "@/lib/triggerPdfGeneration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type ResumeStuckBooksBody = {
  accessToken?: string;
};

async function resumePdfOrFinalEmail(storedBook: NonNullable<Awaited<ReturnType<typeof getBookByAccessToken>>>) {
  const freshBook = (await getBookById(storedBook.id)) || storedBook;
  const normalized = getNormalizedImagesForStoredBook(freshBook);
  const pdfReady = Boolean(freshBook.pdf_storage_path) || freshBook.pdf_status === "ready";

  if (normalized.allIllustrationsReady && pdfReady && isFinalReadyEmailAlreadySent(freshBook)) {
    console.log("[WATCHDOG_FINAL_EMAIL_ALREADY_SENT_SKIP]", {
      bookId: freshBook.id,
    });
    return NextResponse.json({
      resumed: false,
      reason: "already_complete",
      bookId: freshBook.id,
    });
  }

  if (isFinalReadyEmailSendingInProgress(freshBook)) {
    return NextResponse.json({
      resumed: false,
      reason: "final_email_in_progress",
      bookId: freshBook.id,
    });
  }

  console.log("[WATCHDOG_RESUME_PDF_OR_EMAIL]", { bookId: freshBook.id });
  const pdfTrigger = await triggerPdfGenerationIfReady(freshBook.id, "resume-stuck-books");
  return NextResponse.json({
    resumed: pdfTrigger.triggered || pdfTrigger.reason === "pdf_ready_email_only",
    reason: "pdf_or_email_incomplete",
    bookId: freshBook.id,
    pdfTriggered: pdfTrigger.triggered,
    pdfSkipped: pdfTrigger.skipped,
    pdfSkipReason: pdfTrigger.reason,
    pdfStatus: pdfTrigger.pdfStatus,
  });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  const secret = request.headers.get("x-internal-fulfillment-secret");

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResumeStuckBooksBody = {};

  try {
    body = (await request.json()) as ResumeStuckBooksBody;
  } catch {
    body = {};
  }

  try {
    if (body.accessToken) {
      const storedBook = await getBookByAccessToken(body.accessToken);
      if (!storedBook) {
        return NextResponse.json({ resumed: false, reason: "book_not_found" });
      }

      if (!hasPremiumAccess(storedBook.status)) {
        if (storedBook.preview_notify_requested) {
          const result = await resumeFreePreviewGeneration(storedBook.access_token);
          return NextResponse.json({
            resumed: result.resumed || result.freePreviewReady,
            reason: result.reason || "free_preview_resume",
            bookId: result.bookId,
            freePreviewReady: result.freePreviewReady,
            page1Ready: result.page1Ready,
            page2Ready: result.page2Ready,
            previewCoverReady: result.previewCoverReady,
          });
        }

        return NextResponse.json({
          resumed: false,
          reason: "not_premium",
          bookId: storedBook.id,
        });
      }

      const recoveredBook = (await recoverStalePremiumImages(storedBook)) || storedBook;
      const normalized = getNormalizedImagesForStoredBook(recoveredBook);
      const missingPremiumPages = getMissingPremiumImagePages(recoveredBook);

      if (normalized.allIllustrationsReady && missingPremiumPages.length === 0) {
        return resumePdfOrFinalEmail(recoveredBook);
      }
    } else {
      const pdfEmailCandidates = await findPaidBooksNeedingPdfOrFinalEmail(1);
      if (pdfEmailCandidates.length > 0) {
        return resumePdfOrFinalEmail(pdfEmailCandidates[0]!);
      }

      const freePreviewCandidates = await findFreeBooksNeedingPreviewResume(1);
      if (freePreviewCandidates.length > 0) {
        const result = await resumeFreePreviewGeneration(freePreviewCandidates[0]!.access_token);
        return NextResponse.json({
          resumed: result.resumed || result.freePreviewReady,
          reason: result.reason || "free_preview_resume",
          bookId: result.bookId,
          freePreviewReady: result.freePreviewReady,
          page1Ready: result.page1Ready,
          page2Ready: result.page2Ready,
          previewCoverReady: result.previewCoverReady,
        });
      }
    }

    const candidates = body.accessToken
      ? [(await getBookByAccessToken(body.accessToken))].filter(Boolean)
      : await findPaidBooksWithIncompletePremiumGeneration(1);

    if (candidates.length === 0) {
      return NextResponse.json({
        resumed: false,
        reason: "no_stuck_books",
      });
    }

    const storedBook = candidates[0]!;
    if (!hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({
        resumed: false,
        reason: "not_premium",
        bookId: storedBook.id,
      });
    }

    const recoveredBook = (await recoverStalePremiumImages(storedBook)) || storedBook;
    const status = getPremiumGenerationStatus(recoveredBook);
    const missingPremiumPages = getMissingPremiumImagePages(recoveredBook);

    if (missingPremiumPages.length === 0) {
      const pdfTrigger = await triggerPdfGenerationIfReady(recoveredBook.id, "resume-stuck-books");
      return NextResponse.json({
        resumed: pdfTrigger.triggered,
        reason: pdfTrigger.triggered ? "pdf_or_email_incomplete" : "all_premium_images_ready",
        bookId: recoveredBook.id,
        pdfTriggered: pdfTrigger.triggered,
        pdfSkipped: pdfTrigger.skipped,
        pdfSkipReason: pdfTrigger.reason,
        pdfStatus: pdfTrigger.pdfStatus,
      });
    }

    console.log("[PREMIUM_GENERATION_STATUS]", {
      bookId: recoveredBook.id,
      readyImagesCount: status.readyImagesCount,
      missingPremiumPages: status.missingPremiumPages,
      stalePremiumPages: status.stalePremiumPages,
    });

    const result = await generateNextPremiumImage(recoveredBook.access_token);
    const pdfTrigger = result.allIllustrationsReady
      ? await triggerPdfGenerationIfReady(recoveredBook.id, "resume-stuck-books")
      : { triggered: false };

    return NextResponse.json({
      resumed: true,
      bookId: recoveredBook.id,
      accessToken: recoveredBook.access_token,
      generated: result.generated,
      generatedPage: result.pageNumber,
      missingPremiumPages: result.missingPremiumPages,
      stalePremiumPages: result.stalePremiumPages,
      shouldContinuePremiumGeneration: result.shouldContinuePremiumGeneration,
      pdfTriggered: pdfTrigger.triggered,
    });
  } catch (error) {
    console.error("[RESUME_STUCK_BOOKS_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unable to resume stuck book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
