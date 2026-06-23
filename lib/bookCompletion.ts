import "server-only";

import { getBookByAccessToken, markBookReady } from "@/lib/bookStore";
import { getBookReadinessSummary, isBookFullyReady } from "@/lib/book-readiness";
import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export type BookReadyCheckResult = {
  isReady: boolean;
  status: string;
  readyImagesCount: number;
  totalImages: number;
  emailSent: boolean;
  emailSkipped: boolean;
  emailFailed: boolean;
};

export async function checkBookReadyAndFinalize(accessToken: string): Promise<BookReadyCheckResult> {
  console.log("[BOOK_READY_CHECK_START]", accessToken);

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  const summary = getBookReadinessSummary(storedBook);
  if (!hasPremiumAccess(storedBook.status)) {
    return {
      isReady: false,
      status: storedBook.status,
      readyImagesCount: summary.readyImagesCount,
      totalImages: summary.totalImages,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  if (!isBookFullyReady(storedBook)) {
    return {
      isReady: false,
      status: storedBook.status,
      readyImagesCount: summary.readyImagesCount,
      totalImages: summary.totalImages,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  if (storedBook.status !== "ready") {
    await markBookReady(storedBook.id);
    console.log("[BOOK_READY_CHECK_READY]", storedBook.id);
  }

  let emailSent = false;
  let emailSkipped = true;
  let emailFailed = false;

  try {
    const emailResult = await sendConfirmationEmailIfNeeded(accessToken);
    emailSent = emailResult.sent;
    emailSkipped = emailResult.skipped;
    emailFailed = emailResult.failed;

    if (emailResult.sent) {
      console.log("[BOOK_READY_EMAIL_SENT]", storedBook.id);
    }
  } catch (error) {
    emailFailed = true;
    console.error("[BOOK_UNLOCKED_EMAIL_FAILED]", error);
  }

  const latestBook = await getBookByAccessToken(accessToken);
  const latestSummary = latestBook ? getBookReadinessSummary(latestBook) : summary;

  return {
    isReady: true,
    status: latestBook?.status || "ready",
    readyImagesCount: latestSummary.readyImagesCount,
    totalImages: latestSummary.totalImages,
    emailSent,
    emailSkipped,
    emailFailed,
  };
}
