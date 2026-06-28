import { NextResponse } from "next/server";
import { createSignedPdfUrl, downloadBookPdf, getBookByAccessToken } from "@/lib/bookStore";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60;

function isMobileUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return false;
  }

  return /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent);
}

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const accessToken = token?.trim();
  const userAgent = request.headers.get("user-agent");
  const isMobile = isMobileUserAgent(userAgent);

  if (!accessToken) {
    return NextResponse.json({ success: false, error: "PDF_NOT_READY" }, { status: 400 });
  }

  console.log("[PDF_DOWNLOAD_ROUTE_HIT]", { accessToken });

  try {
    const storedBook = await getBookByAccessToken(accessToken);
    if (!storedBook) {
      return NextResponse.json({ success: false, error: "BOOK_NOT_FOUND" }, { status: 404 });
    }

    console.log("[PDF_DOWNLOAD_BOOK_FOUND]", {
      bookId: storedBook.id,
      hasPdfStoragePath: Boolean(storedBook.pdf_storage_path),
    });

    if (!hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({ success: false, error: "PDF_NOT_READY" }, { status: 403 });
    }

    if (!storedBook.pdf_storage_path) {
      return NextResponse.json({ success: false, error: "PDF_NOT_READY" }, { status: 409 });
    }

    console.log("[PDF_DOWNLOAD_SIGNED_URL_CREATED]", { bookId: storedBook.id });

    if (isMobile) {
      const pdfBuffer = await downloadBookPdf(storedBook.pdf_storage_path);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="legend-book.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    const signedUrl = await createSignedPdfUrl(storedBook.pdf_storage_path, PDF_SIGNED_URL_TTL_SECONDS);
    console.log("[PDF_DOWNLOAD_REDIRECT]", { bookId: storedBook.id });
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("[PDF_DOWNLOAD_ROUTE_FAILED]", {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ success: false, error: "PDF_OPEN_FAILED" }, { status: 500 });
  }
}
