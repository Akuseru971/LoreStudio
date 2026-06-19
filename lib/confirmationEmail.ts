import {
  claimConfirmationEmailSend,
  getBookByAccessToken,
  markConfirmationEmailFailed,
  markConfirmationEmailSent,
  markConfirmationEmailSkipped,
} from "@/lib/bookStore";
import { buildBookUnlockedEmailUrls, sendBookUnlockedEmail } from "@/lib/email";

export async function sendConfirmationEmailIfNeeded(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return { sent: false, skipped: true, reason: "book_not_found" as const };
  }

  if (storedBook.confirmation_email_sent_at || storedBook.confirmation_email_status === "sent") {
    return { sent: false, skipped: true, reason: "already_sent" as const, recoveryEmailAvailable: true };
  }

  if (!storedBook.email) {
    await markConfirmationEmailSkipped(storedBook.id);
    return { sent: false, skipped: true, reason: "missing_email" as const };
  }

  const claimedBook = await claimConfirmationEmailSend(storedBook.id);
  if (!claimedBook) {
    return { sent: false, skipped: true, reason: "already_claimed" as const };
  }

  const urls = buildBookUnlockedEmailUrls(claimedBook.access_token);
  const result = await sendBookUnlockedEmail({
    to: claimedBook.email!,
    bookUrl: urls.bookUrl,
    pdfUrl: urls.pdfUrl,
    mp3Url: urls.mp3Url,
    idempotencyKey: `book-unlocked/${claimedBook.id}`,
  });

  if (!result.sent) {
    await markConfirmationEmailFailed(claimedBook.id);
    return { sent: false, skipped: false, reason: "send_failed" as const, error: result.error };
  }

  await markConfirmationEmailSent(claimedBook.id);
  return { sent: true, skipped: false, reason: "sent" as const, recoveryEmailAvailable: true };
}
