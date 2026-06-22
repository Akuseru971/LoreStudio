import { NextResponse } from "next/server";
import { resolvePdfDownload } from "@/lib/pdfDownload";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";
import { getSafeApiErrorMessage, isSupabaseSchemaError } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_NAME = "/api/download-pdf";

export async function GET(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ status: "failed", message: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await resolvePdfDownload(token);
    logRouteSuccess(ROUTE_NAME);
    const httpStatus = result.status === "failed" && result.message === "Book not found." ? 404 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "PDF could not be generated.");
    if (response) {
      return response;
    }

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
