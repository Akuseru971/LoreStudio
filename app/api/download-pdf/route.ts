import { NextResponse } from "next/server";
import {
  createSignedPdfUrl,
  ensureBookPdf,
  getBookByAccessToken,
} from "@/lib/bookStore";
import { ensureAllBookImagesReady } from "@/lib/premiumImages";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const storedBook = await getBookByAccessToken(token);
    if (!storedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    if (!hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({ error: "Premium access is required." }, { status: 403 });
    }

    const { book } = await ensureAllBookImagesReady(token);

    const pdfStoragePath = storedBook.pdf_storage_path || (await ensureBookPdf(storedBook.id, book));
    const url = await createSignedPdfUrl(pdfStoragePath, 3600);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to create PDF download URL.", error);
    const message = error instanceof Error ? error.message : "Unable to download PDF.";
    const status = message.includes("still being prepared") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
