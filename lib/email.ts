import { Resend } from "resend";
import type { StoredBook } from "@/lib/types";

const BLOCKED_FROM_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.com"] as const;

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

export function validateFromEmail(fromEmail: string) {
  const normalized = fromEmail.toLowerCase();

  for (const domain of BLOCKED_FROM_EMAIL_DOMAINS) {
    if (normalized.includes(domain)) {
      return `FROM_EMAIL uses ${domain}. Resend requires a verified custom domain.`;
    }
  }

  return null;
}

export type BookReadyEmailInput = {
  to: string;
  bookUrl: string;
  pdfUrl?: string | null;
  mp3Url?: string | null;
  idempotencyKey: string;
};

function buildBookReadyEmailBody(bookUrl: string, pdfUrl?: string | null, mp3Url?: string | null) {
  const lines = [
    "Your legend is now complete.",
    "",
    "Read your full interactive book here:",
    bookUrl,
  ];

  if (pdfUrl) {
    lines.push("", "Download your PDF:", pdfUrl);
  }

  if (mp3Url) {
    lines.push("", "Download your MP3 narration:", mp3Url);
  }

  lines.push(
    "",
    "Keep this email safe. This private link lets you recover your book without creating an account.",
  );

  return lines.join("\n");
}

function buildBookReadyEmailHtml(bookUrl: string, pdfUrl?: string | null, mp3Url?: string | null) {
  const sections = [
    `<p style="font-size: 16px; line-height: 1.8; color: #4a3724;">Your legend is now complete.</p>`,
    `<p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
      Read your full interactive book here:<br />
      <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
    </p>`,
  ];

  if (pdfUrl) {
    sections.push(`<p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
      Download your PDF:<br />
      <a href="${pdfUrl}" style="color: #4a3724;">${pdfUrl}</a>
    </p>`);
  }

  if (mp3Url) {
    sections.push(`<p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
      Download your MP3 narration:<br />
      <a href="${mp3Url}" style="color: #4a3724;">${mp3Url}</a>
    </p>`);
  }

  sections.push(`<p style="font-size: 14px; line-height: 1.7; color: #6b4a24;">
    Keep this email safe. This private link lets you recover your book without creating an account.
  </p>`);

  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
      ${sections.join("\n")}
    </div>
  `;
}

export async function sendBookReadyEmail({
  to,
  bookUrl,
  pdfUrl,
  mp3Url,
  idempotencyKey,
}: BookReadyEmailInput) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!resend || !fromEmail) {
    console.warn("Confirmation email not sent: missing Resend configuration.");
    return { sent: false, error: "Email provider is not configured." };
  }

  const fromEmailError = validateFromEmail(fromEmail);
  if (fromEmailError) {
    console.error("[BOOK_READY_EMAIL_FAILED]", fromEmailError);
    return { sent: false, error: fromEmailError };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your complete legend is ready",
      text: buildBookReadyEmailBody(bookUrl, pdfUrl, mp3Url),
      html: buildBookReadyEmailHtml(bookUrl, pdfUrl, mp3Url),
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("[BOOK_READY_EMAIL_FAILED]", error);
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id };
}

export function buildBookReadyEmailUrls(book: Pick<StoredBook, "access_token">) {
  const appUrl = getAppUrl();
  const token = encodeURIComponent(book.access_token);

  return {
    bookUrl: `${appUrl}/book/${book.access_token}`,
    pdfUrl: `${appUrl}/api/download-pdf?token=${token}`,
    mp3Url: `${appUrl}/api/download-mp3?token=${token}`,
  };
}

/** @deprecated Use buildBookReadyEmailUrls instead. */
export function buildBookUnlockedEmailUrls(accessToken: string) {
  return buildBookReadyEmailUrls({ access_token: accessToken });
}

/** @deprecated Use sendBookReadyEmail instead. */
export async function sendBookUnlockedEmail(input: BookReadyEmailInput & { characterName?: string }) {
  return sendBookReadyEmail(input);
}
