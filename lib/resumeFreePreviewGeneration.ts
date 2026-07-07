import "server-only";

import { getImageForPage, isIllustrationReady } from "@/lib/book-images";
import { getBookByAccessToken, repairPreviewCoverFromStorage } from "@/lib/bookStore";
import { triggerFreePreviewReadyEmailCheck } from "@/lib/freePreviewReadyEmail";
import {
  generateNextFreeImage,
  getFreeImagePagesInput,
  getFreePreviewReadiness,
  isFreePage1Ready,
  isRecentFreePageImageGenerationInProgress,
  isRecentPreviewCoverGenerationInProgress,
  logImageGenerationSkipAlreadyGeneratingRecent,
  recoverStaleFreePreviewAssets,
  type FreePreviewReadiness,
} from "@/lib/freeImages";
import {
  getPageGenerationStatus,
  getPreviewCoverGenerationStatus,
} from "@/lib/imageGenerationTimestamps";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export type ResumeFreePreviewGenerationResult = {
  bookId: string;
  resumed: boolean;
  freePreviewReady: boolean;
  page1Ready: boolean;
  page2Ready: boolean;
  previewCoverReady: boolean;
  reason?: string;
};

function logResumeStatus(bookId: string, readiness: FreePreviewReadiness) {
  console.log("[PREVIEW_NOTIFY_BACKGROUND_RESUME_STATUS]", {
    bookId,
    page1Ready: readiness.page1Ready,
    page2Ready: readiness.page2Ready,
    previewCoverReady: readiness.previewCoverReady,
    freePreviewReady: readiness.freePreviewReady,
  });
}

function logSkipAlreadyGenerating(bookId: string, asset: "page_1" | "page_2" | "preview_cover") {
  console.log("[PREVIEW_NOTIFY_BACKGROUND_RESUME_SKIPPED_ALREADY_GENERATING]", {
    bookId,
    asset,
  });
}

async function refreshBook(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return null;
  }

  return repairPreviewCoverFromStorage(storedBook);
}

export async function resumeFreePreviewGeneration(
  accessToken: string,
): Promise<ResumeFreePreviewGenerationResult> {
  let book = await getBookByAccessToken(accessToken);
  if (!book) {
    return {
      bookId: "",
      resumed: false,
      freePreviewReady: false,
      page1Ready: false,
      page2Ready: false,
      previewCoverReady: false,
      reason: "book_not_found",
    };
  }

  console.log("[PREVIEW_NOTIFY_BACKGROUND_RESUME_STARTED]", { bookId: book.id });

  if (hasPremiumAccess(book.status)) {
    return {
      bookId: book.id,
      resumed: false,
      freePreviewReady: false,
      page1Ready: false,
      page2Ready: false,
      previewCoverReady: false,
      reason: "not_free",
    };
  }

  book = await repairPreviewCoverFromStorage(book);
  book = (await recoverStaleFreePreviewAssets(book)) || book;

  let readiness = getFreePreviewReadiness(book);
  logResumeStatus(book.id, readiness);

  if (readiness.freePreviewReady) {
    await triggerFreePreviewReadyEmailCheck(book.id);
    return {
      bookId: book.id,
      resumed: false,
      freePreviewReady: true,
      page1Ready: readiness.page1Ready,
      page2Ready: readiness.page2Ready,
      previewCoverReady: readiness.previewCoverReady,
      reason: "already_ready",
    };
  }

  if (!book.free_book) {
    return {
      bookId: book.id,
      resumed: false,
      freePreviewReady: false,
      page1Ready: readiness.page1Ready,
      page2Ready: readiness.page2Ready,
      previewCoverReady: readiness.previewCoverReady,
      reason: "preview_text_not_ready",
    };
  }

  let progressMade = false;

  if (!readiness.page1Ready) {
    const input = getFreeImagePagesInput(book);
    const page1Image = getImageForPage(input, 1);

    if (isRecentFreePageImageGenerationInProgress(book, 1)) {
      logSkipAlreadyGenerating(book.id, "page_1");
    } else if (!isIllustrationReady(page1Image)) {
      await generateNextFreeImage(accessToken, 1);
      progressMade = true;
    }

    const refreshedBook = await refreshBook(accessToken);
    if (!refreshedBook) {
      return {
        bookId: book.id,
        resumed: progressMade,
        freePreviewReady: false,
        page1Ready: false,
        page2Ready: false,
        previewCoverReady: false,
        reason: "book_not_found",
      };
    }

    book = refreshedBook;
    readiness = getFreePreviewReadiness(book);
    logResumeStatus(book.id, readiness);

    if (readiness.freePreviewReady) {
      await triggerFreePreviewReadyEmailCheck(book.id);
      return {
        bookId: book.id,
        resumed: progressMade,
        freePreviewReady: true,
        page1Ready: readiness.page1Ready,
        page2Ready: readiness.page2Ready,
        previewCoverReady: readiness.previewCoverReady,
        reason: "completed_after_page_1",
      };
    }
  }

  if (isFreePage1Ready(book)) {
    const input = getFreeImagePagesInput(book);
    const parallelTasks: Array<Promise<unknown>> = [];

    if (!readiness.page2Ready) {
      const page2Image = getImageForPage(input, 2);
      if (isRecentFreePageImageGenerationInProgress(book, 2)) {
        logSkipAlreadyGenerating(book.id, "page_2");
      } else if (!isIllustrationReady(page2Image)) {
        console.log("[PREVIEW_NOTIFY_BACKGROUND_RESUME_START_PAGE_2]", { bookId: book.id });
        parallelTasks.push(generateNextFreeImage(accessToken, { pageNumber: 2 }));
        progressMade = true;
      }
    }

    if (!readiness.previewCoverReady) {
      if (isRecentPreviewCoverGenerationInProgress(book)) {
        logSkipAlreadyGenerating(book.id, "preview_cover");
      } else {
        parallelTasks.push(generateNextFreeImage(accessToken, { previewCover: true }));
        progressMade = true;
      }
    }

    if (parallelTasks.length > 0) {
      await Promise.allSettled(parallelTasks);
    }
  }

  const finalBook = await refreshBook(accessToken);
  if (!finalBook) {
    return {
      bookId: book.id,
      resumed: progressMade,
      freePreviewReady: false,
      page1Ready: readiness.page1Ready,
      page2Ready: readiness.page2Ready,
      previewCoverReady: readiness.previewCoverReady,
      reason: "book_not_found",
    };
  }

  const finalReadiness = getFreePreviewReadiness(finalBook);
  logResumeStatus(finalBook.id, finalReadiness);

  if (finalReadiness.freePreviewReady) {
    await triggerFreePreviewReadyEmailCheck(finalBook.id);
  } else if (!progressMade) {
    const page2State = getPageGenerationStatus(finalBook, 2);
    const previewCoverState = getPreviewCoverGenerationStatus(finalBook);
    if (
      (page2State.status === "generating" && !page2State.isReady) ||
      (previewCoverState.status === "generating" && !previewCoverState.isReady)
    ) {
      return {
        bookId: finalBook.id,
        resumed: false,
        freePreviewReady: false,
        page1Ready: finalReadiness.page1Ready,
        page2Ready: finalReadiness.page2Ready,
        previewCoverReady: finalReadiness.previewCoverReady,
        reason: "waiting_for_in_progress_generation",
      };
    }
  }

  return {
    bookId: finalBook.id,
    resumed: progressMade,
    freePreviewReady: finalReadiness.freePreviewReady,
    page1Ready: finalReadiness.page1Ready,
    page2Ready: finalReadiness.page2Ready,
    previewCoverReady: finalReadiness.previewCoverReady,
    reason: finalReadiness.freePreviewReady ? "completed" : progressMade ? "partial_progress" : "no_work_needed",
  };
}
