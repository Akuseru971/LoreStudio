/**
 * Browser-safe API wrappers for post-payment and book access flows.
 * Never import OpenAI or other secret SDKs here — only call backend routes.
 */

type VerifyPaymentInput = {
  accessToken: string;
  sessionId: string;
};

export async function verifyPayment(input: VerifyPaymentInput) {
  const response = await fetch("/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();
  return { response, data };
}

export async function generatePremiumImages(accessToken: string) {
  return fetch("/api/generate-premium-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

export async function fetchBookStatus(accessToken: string) {
  const response = await fetch(`/api/book-status?token=${encodeURIComponent(accessToken)}`);
  const data = await response.json();
  return { response, data };
}

export async function fetchBook(accessToken: string) {
  const response = await fetch(`/api/book?token=${encodeURIComponent(accessToken)}`);
  const data = await response.json();
  return { response, data };
}

export async function generateNextFreeImage(accessToken: string) {
  const response = await fetch("/api/generate-next-free-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  const data = await response.json();
  return { response, data };
}

export async function retryMissingImages(accessToken: string) {
  return fetch("/api/retry-missing-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

export async function downloadPdf(accessToken: string) {
  const response = await fetch(`/api/download-pdf?token=${encodeURIComponent(accessToken)}`);
  const data = await response.json();
  return { response, data };
}

export async function downloadMp3(accessToken: string) {
  const response = await fetch(`/api/download-mp3?token=${encodeURIComponent(accessToken)}`);
  const data = await response.json();
  return { response, data };
}

export async function generatePageAudio(body: {
  text: string;
  pageNumber: number;
  accessToken: string;
}) {
  const response = await fetch("/api/generate-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

export async function generateImage(body: { book: unknown; pageNumber: number }) {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

export async function generateNarratorTeaser() {
  const response = await fetch("/api/generate-narrator-teaser", { method: "POST" });
  const data = await response.json();
  return { response, data };
}
