import "server-only";

import { sendConfirmationEmailIfNeeded } from "@/lib/confirmationEmail";
import { isBookFullyReady } from "@/lib/book-readiness";
import { getBookByAccessToken, markBookAssetsReady } from "@/lib/bookStore";

export type FinalizeBookResult = {
  finalized: boolean;
  alreadyReady: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailFailed: boolean;
};

export async function finalizeBookIfReady(accessToken: string): Promise<FinalizeBookResult> {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return {
      finalized: false,
      alreadyReady: false,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  if (storedBook.status === "ready" && storedBook.confirmation_email_sent_at) {
    return {
      finalized: false,
      alreadyReady: true,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  if (!isBookFullyReady(storedBook)) {
    return {
      finalized: false,
      alreadyReady: false,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  if (storedBook.status !== "ready") {
    await markBookAssetsReady(storedBook.id);
  }

  const emailResult = await sendConfirmationEmailIfNeeded(accessToken);

  return {
    finalized: true,
    alreadyReady: storedBook.status === "ready",
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped,
    emailFailed: emailResult.failed,
  };
}
