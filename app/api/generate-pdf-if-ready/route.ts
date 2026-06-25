import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { getNormalizedImagesForStoredBook } from "@/lib/book-images";
import { triggerFinalBookReadyEmailCheck } from "@/lib/finalBookReadyEmail";
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
    const emailResult = await triggerFinalBookReadyEmailCheck(storedBook.id).catch((error) => {
      console.error("[FINAL_READY_EMAIL_FAILED]", { bookId: storedBook.id, error });
      return { sent: false, reason: "unexpected_error" as const };
    });

    return NextResponse.json({
      success: true,
      status: "ready",
      pdfStatus: "ready",
      pdfReady: true,
      message: "PDF is already ready.",
      finalEmailSent: emailResult.sent,
      finalEmailReason: emailResult.reason,
    });
  }

  try {
    console.log("[GENERATE_PDF_IF_READY_START]", { bookId: storedBook.id });
    const result = await resolvePdfDownload(accessToken);

    if (result.status === "ready") {
      const emailResult = await triggerFinalBookReadyEmailCheck(storedBook.id).catch((error) => {
        console.error("[FINAL_READY_EMAIL_FAILED]", { bookId: storedBook.id, error });
        return { sent: false, reason: "unexpected_error" as const };
      });

      return NextResponse.json({
        success: true,
        status: result.status,
        pdfStatus: "ready",
        pdfReady: true,
        downloadUrl: result.downloadUrl,
        message: result.message,
        finalEmailSent: emailResult.sent,
        finalEmailReason: emailResult.reason,
      });
    }

    return NextResponse.json({
      success: false,
      status: result.status,
      pdfStatus: storedBook.pdf_status || "generating",
      pdfReady: false,
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
