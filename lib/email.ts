import { Resend } from "resend";

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
  characterName,
  idempotencyKey,
}: BookUnlockedEmailInput) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL;

  if (!resend || !fromEmail) {
    console.warn("Confirmation email not sent: missing Resend configuration.");
    return { sent: false, error: "Email provider is not configured." };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your legend is unlocked",
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <p style="letter-spacing: 0.28em; text-transform: uppercase; font-size: 12px; color: #8a6231;">Thank you for unlocking the full book</p>
          <h1 style="font-size: 28px; color: #24170b; margin: 16px 0 12px;">Your complete legend is now unlocked.</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #4a3724;">
            Thank you for unlocking ${characterName}'s full chronicle. Your interactive book, PDF, and narration are ready whenever you return.
          </p>
          <div style="margin: 28px 0;">
            <p style="font-size: 15px; line-height: 1.8; color: #4a3724;">
              Read your interactive book here:<br />
              <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
            </p>
            <p style="font-size: 15px; line-height: 1.8; color: #4a3724;">
              Download your PDF:<br />
              <a href="${pdfUrl}" style="color: #4a3724;">${pdfUrl}</a>
            </p>
            <p style="font-size: 15px; line-height: 1.8; color: #4a3724;">
              Download your full narration MP3:<br />
              <a href="${mp3Url}" style="color: #4a3724;">${mp3Url}</a>
            </p>
          </div>
          <p style="font-size: 14px; line-height: 1.7; color: #6b4a24;">
            Keep this email safe. This private link lets you recover your legend without creating an account.
          </p>
        </div>
      `,
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("Failed to send book unlocked email.", error);
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
