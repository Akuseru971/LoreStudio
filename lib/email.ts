import { Resend } from "resend";
import type { StoredBook } from "@/lib/types";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

export async function sendBookReadyEmail(book: StoredBook) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL;
  const appUrl = getAppUrl();

  if (!resend || !fromEmail || !book.email) {
    console.warn("Email not sent: missing Resend configuration or recipient email.");
    return { sent: false };
  }

  const bookUrl = `${appUrl}/book/${book.access_token}`;
  const pdfUrl = `${appUrl}/api/download-pdf?token=${encodeURIComponent(book.access_token)}`;
  const mp3Url = `${appUrl}/api/download-mp3?token=${encodeURIComponent(book.access_token)}`;
  const characterName = book.full_book?.characterBible.name || book.free_book?.characterBible.name || "your champion";

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [book.email],
      subject: "Your legend is unlocked",
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <p style="letter-spacing: 0.28em; text-transform: uppercase; font-size: 12px; color: #8a6231;">Your complete interactive book is ready</p>
          <h1 style="font-size: 28px; color: #24170b; margin: 16px 0 12px;">${characterName}'s legend awaits.</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #4a3724;">
            Your complete interactive book is ready. Continue reading on the website, or keep parchment and narration copies as backup.
          </p>
          <div style="margin: 28px 0;">
            <a href="${bookUrl}" style="display:inline-block; margin-right: 12px; margin-bottom: 12px; padding: 14px 22px; background: #b89452; color: #120d07; text-decoration: none; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px;">
              Open your interactive book
            </a>
            <a href="${pdfUrl}" style="display:inline-block; margin-right: 12px; margin-bottom: 12px; padding: 14px 22px; border: 1px solid #8a6231; color: #4a3724; text-decoration: none; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px;">
              Download PDF
            </a>
            <a href="${mp3Url}" style="display:inline-block; margin-bottom: 12px; padding: 14px 22px; border: 1px solid #8a6231; color: #4a3724; text-decoration: none; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px;">
              Download MP3 narration
            </a>
          </div>
          <p style="font-size: 13px; line-height: 1.6; color: #6b4a24;">
            Your private link will keep this legend waiting for you:<br />
            <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
          </p>
        </div>
      `,
    },
    { idempotencyKey: `book-ready/${book.id}` },
  );

  if (error) {
    console.error("Failed to send book ready email.", error);
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id };
}
