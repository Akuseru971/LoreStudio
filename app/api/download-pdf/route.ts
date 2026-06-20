import { NextResponse } from "next/server";
import { resolvePdfDownload } from "@/lib/pdfDownload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ status: "failed", message: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await resolvePdfDownload(token);
    const httpStatus = result.status === "failed" && result.message === "Book not found." ? 404 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    console.error("[PDF_DOWNLOAD_ROUTE_ERROR]", error);
    return NextResponse.json(
      {
        status: "failed",
        message: "PDF could not be generated.",
      },
      { status: 500 },
    );
  }
}
