import { Resend } from "resend";

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

export type BookUnlockedEmailInput = {
  to: string;
  bookUrl: string;
  pdfUrl: string;
  mp3Url: string;
  characterName: string;
  idempotencyKey: string;
};

export async function sendBookUnlockedEmail({
  to,
  bookUrl,
  pdfUrl,
  mp3Url,
  idempotencyKey,
}: Omit<BookUnlockedEmailInput, "characterName"> & { characterName?: string }) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!resend || !fromEmail) {
    console.warn("Confirmation email not sent: missing Resend configuration.");
    return { sent: false, error: "Email provider is not configured." };
  }

  const fromEmailError = validateFromEmail(fromEmail);
  if (fromEmailError) {
    console.error("[BOOK_UNLOCKED_EMAIL_FAILED]", fromEmailError);
    return { sent: false, error: fromEmailError };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your legend is unlocked",
      text: `Your complete legend is now unlocked.

Read your interactive book here:
${bookUrl}

Download your PDF:
${pdfUrl}

Download your full narration MP3:
${mp3Url}

Keep this email safe. This private link lets you recover your legend without creating an account.`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <p style="font-size: 16px; line-height: 1.8; color: #4a3724;">Your complete legend is now unlocked.</p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Read your interactive book here:<br />
            <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Download your PDF:<br />
            <a href="${pdfUrl}" style="color: #4a3724;">${pdfUrl}</a>
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Download your full narration MP3:<br />
            <a href="${mp3Url}" style="color: #4a3724;">${mp3Url}</a>
          </p>
          <p style="font-size: 14px; line-height: 1.7; color: #6b4a24;">
            Keep this email safe. This private link lets you recover your legend without creating an account.
          </p>
        </div>
      `,
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("[BOOK_UNLOCKED_EMAIL_FAILED]", error);
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id };
}

export type PdfFinalizedEmailInput = {
  to: string;
  bookUrl: string;
  pdfUrl: string;
  idempotencyKey: string;
};

export async function sendPdfFinalizedEmail({ to, bookUrl, pdfUrl, idempotencyKey }: PdfFinalizedEmailInput) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!resend || !fromEmail) {
    console.warn("PDF finalized email not sent: missing Resend configuration.");
    return { sent: false, error: "Email provider is not configured." };
  }

  const fromEmailError = validateFromEmail(fromEmail);
  if (fromEmailError) {
    console.error("[PDF_FINALIZED_EMAIL_FAILED]", fromEmailError);
    return { sent: false, error: fromEmailError };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your PDF is ready",
      text: `Your complete illustrated legend is ready.

You can access your book here:
${bookUrl}

You can download your PDF here:
${pdfUrl}

Keep this email safe. Your private link lets you recover your book without creating an account.`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <p style="font-size: 16px; line-height: 1.8; color: #4a3724;">Your complete illustrated legend is ready.</p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            You can access your book here:<br />
            <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            You can download your PDF here:<br />
            <a href="${pdfUrl}" style="color: #4a3724;">${pdfUrl}</a>
          </p>
          <p style="font-size: 14px; line-height: 1.7; color: #6b4a24;">
            Keep this email safe. Your private link lets you recover your book without creating an account.
          </p>
        </div>
      `,
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("[PDF_FINALIZED_EMAIL_FAILED]", error);
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id };
}

export function buildBookUnlockedEmailUrls(accessToken: string) {
  const appUrl = getAppUrl();
  return {
    bookUrl: `${appUrl}/book/${accessToken}`,
    pdfUrl: `${appUrl}/api/download-pdf?token=${encodeURIComponent(accessToken)}`,
    mp3Url: `${appUrl}/api/download-mp3?token=${encodeURIComponent(accessToken)}`,
  };
}
