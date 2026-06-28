import { NextResponse } from "next/server";
import { resolvePdfDownload } from "@/lib/pdfDownload";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const maxDuration = 300;

function isBrowserNavigation(request: Request) {
  const secFetchMode = request.headers.get("sec-fetch-mode");
  if (secFetchMode === "cors" || secFetchMode === "no-cors") {
    return false;
  }

  if (secFetchMode === "navigate") {
    return true;
  }

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ status: "failed", message: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await resolvePdfDownload(token);

    if (isBrowserNavigation(request) && result.status === "ready" && result.downloadUrl) {
      return NextResponse.redirect(result.downloadUrl, { status: 302 });
    }

    const httpStatus = result.status === "failed" && result.message === "Book not found." ? 404 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    console.error("[PDF_DOWNLOAD_ROUTE_ERROR]", error);
    const message = getSafeApiErrorMessage(error, "PDF could not be generated.");
    return NextResponse.json(
      {
        status: "failed",
        message,
        reason: isSupabaseSchemaError(error) ? "schema_out_of_date" : undefined,
      },
      { status: isSupabaseSchemaError(error) ? 503 : 500 },
    );
  }
}
