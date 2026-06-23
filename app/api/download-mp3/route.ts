import { NextResponse } from "next/server";
import { createSignedMp3Url, getBookByAccessToken } from "@/lib/bookStore";
import { ensureFullBookMp3 } from "@/lib/fullNarration";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_NAME = "/api/download-mp3";

export async function GET(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

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

    const mp3StoragePath = await ensureFullBookMp3(token);
    const url = await createSignedMp3Url(mp3StoragePath, 3600);

    logRouteSuccess(ROUTE_NAME);
    return NextResponse.json({ url });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "Unable to download narration.");
    if (response) {
      return response;
    }

    const message = error instanceof Error ? error.message : "Unable to download narration.";
    const status = message.includes("still being prepared") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
