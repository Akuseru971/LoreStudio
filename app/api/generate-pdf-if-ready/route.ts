import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { resolvePdfDownload } from "@/lib/pdfDownload";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type GeneratePdfIfReadyBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as GeneratePdfIfReadyBody;
  const accessToken = body.accessToken?.trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  if (!hasPremiumAccess(storedBook.status)) {
    return NextResponse.json({ error: "Premium access is required." }, { status: 403 });
  }

  const normalized = getNormalizedImagesForStoredBook(storedBook);

  if (!normalized.allIllustrationsReady) {
    return NextResponse.json({
      success: false,
      status: "not_ready",
      pdfStatus: storedBook.pdf_status || "not_started",
      pdfReady: Boolean(storedBook.pdf_storage_path),
      message: "Illustrations are still being prepared.",
      readyImagesCount: normalized.readyIllustrationCount,
      totalImages: 8,
    });
  }

  if (storedBook.pdf_storage_path && storedBook.pdf_status === "ready") {
    return NextResponse.json({
      success: true,
      status: "ready",
      pdfStatus: "ready",
      pdfReady: true,
      message: "PDF is already ready.",
    });
  }

  try {
    console.log("[GENERATE_PDF_IF_READY_START]", { bookId: storedBook.id });
    const result = await resolvePdfDownload(accessToken);

    return NextResponse.json({
      success: result.status === "ready",
      status: result.status,
      pdfStatus: result.status === "ready" ? "ready" : storedBook.pdf_status || "generating",
      pdfReady: result.status === "ready",
      downloadUrl: result.downloadUrl,
      message: result.message,
    });
  } catch (error) {
    console.error("[GENERATE_PDF_IF_READY_ERROR]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed.";
    return NextResponse.json({
      success: false,
      status: "failed",
      pdfStatus: "failed",
      pdfReady: false,
      message,
    });
  }
}
