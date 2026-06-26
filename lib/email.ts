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

export type PaymentConfirmationEmailInput = {
  to: string;
  bookUrl: string;
  idempotencyKey: string;
};

export async function sendPaymentConfirmationEmail({
  to,
  bookUrl,
  idempotencyKey,
}: PaymentConfirmationEmailInput) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!resend || !fromEmail) {
    console.warn("[PAYMENT_EMAIL_FAILED]", { error: "Email provider is not configured." });
    return { sent: false, error: "Email provider is not configured." };
  }

  const fromEmailError = validateFromEmail(fromEmail);
  if (fromEmailError) {
    console.error("[PAYMENT_EMAIL_FAILED]", { error: fromEmailError });
    return { sent: false, error: fromEmailError };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your legend is being prepared",
      text: `Your legend is being prepared

Your payment has been confirmed. Your complete illustrated legend is now being prepared.

You will receive a second email as soon as your full book and PDF are ready.

You can already access your private book page here:
${bookUrl}`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <h1 style="font-size: 24px; line-height: 1.3; color: #2f2419; margin: 0 0 20px;">Your legend is being prepared</h1>
          <p style="font-size: 16px; line-height: 1.8; color: #4a3724;">
            Your payment has been confirmed. Your complete illustrated legend is now being prepared.
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            You will receive a second email as soon as your full book and PDF are ready.
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            You can already access your private book page here:<br />
            <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
          </p>
        </div>
      `,
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("[PAYMENT_EMAIL_FAILED]", { error: error.message });
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id };
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
  idempotencyKey,
}: Omit<BookUnlockedEmailInput, "characterName" | "pdfUrl" | "mp3Url"> & {
  characterName?: string;
  pdfUrl?: string;
  mp3Url?: string;
}) {
  return sendPaymentConfirmationEmail({ to, bookUrl, idempotencyKey });
}

export type FinalBookReadyEmailInput = {
  to: string;
  bookUrl: string;
  pdfUrl: string;
  idempotencyKey: string;
};

export async function sendFinalBookReadyEmail({ to, bookUrl, pdfUrl, idempotencyKey }: FinalBookReadyEmailInput) {
  const resend = getResendClient();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!resend || !fromEmail) {
    console.warn("Final book ready email not sent: missing Resend configuration.");
    return { sent: false, error: "Email provider is not configured." };
  }

  const fromEmailError = validateFromEmail(fromEmail);
  if (fromEmailError) {
    console.error("[FINAL_READY_EMAIL_FAILED]", fromEmailError);
    return { sent: false, error: fromEmailError };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: [to],
      subject: "Your complete legend is ready",
      text: `Your complete legend is fully unlocked

Your complete illustrated legend is now ready.

Your full book, premium illustrations, and PDF are available from your private link.

Access your complete legend here:
${bookUrl}

Download your PDF here:
${pdfUrl}`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2419; background: #f5ead2; padding: 32px;">
          <h1 style="font-size: 24px; line-height: 1.3; color: #2f2419; margin: 0 0 20px;">Your complete legend is fully unlocked</h1>
          <p style="font-size: 16px; line-height: 1.8; color: #4a3724;">
            Your complete illustrated legend is now ready.
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Your full book, premium illustrations, and PDF are available from your private link.
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Access your complete legend here:<br />
            <a href="${bookUrl}" style="color: #4a3724;">${bookUrl}</a>
          </p>
          <p style="font-size: 15px; line-height: 1.9; color: #4a3724;">
            Download your PDF here:<br />
            <a href="${pdfUrl}" style="color: #4a3724;">${pdfUrl}</a>
          </p>
        </div>
      `,
    },
    { idempotencyKey },
  );

  if (error) {
    console.error("[FINAL_READY_EMAIL_FAILED]", error);
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
