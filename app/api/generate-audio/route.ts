import { NextResponse } from "next/server";
import { createSignedAssetUrl } from "@/lib/bookAssets";
import { getBookByAccessToken, saveBookAsset } from "@/lib/bookStore";
import { generateNarrationAudioBuffer } from "@/lib/elevenlabs";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";
import { dataUrlFromBase64, sanitizeText } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_NAME = "/api/generate-audio";

export async function POST(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

  try {
    const body = (await request.json()) as {
      text?: unknown;
      pageNumber?: unknown;
      accessToken?: unknown;
    };
    const text = sanitizeText(body.text, 900);
    const pageNumber = Number(body.pageNumber);
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    if (!text || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 8) {
      return NextResponse.json({ audioUrl: null, error: "Invalid narration request." }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { audioUrl: null, error: "Premium access is required for narration." },
        { status: 403 },
      );
    }

    const storedBook = await getBookByAccessToken(accessToken);
    if (!storedBook || !hasPremiumAccess(storedBook.status)) {
      return NextResponse.json(
        { audioUrl: null, error: "Premium access is required for narration." },
        { status: 403 },
      );
    }

    const existingStoragePath = storedBook.audio[String(pageNumber)];
    if (existingStoragePath) {
      const audioUrl = await createSignedAssetUrl(existingStoragePath, 3600);
      logRouteSuccess(ROUTE_NAME);
      return NextResponse.json({ audioUrl });
    }

    const audioBuffer = await generateNarrationAudioBuffer(text, { pageNumber });
    if (!audioBuffer) {
      return NextResponse.json({ audioUrl: null, error: "Unable to generate narration." }, { status: 500 });
    }

    const dataUrl = dataUrlFromBase64(audioBuffer.toString("base64"), "audio/mpeg");
    const updatedBook = await saveBookAsset(accessToken, pageNumber, "audio", dataUrl);
    const storagePath = updatedBook.audio[String(pageNumber)];
    const audioUrl = storagePath ? await createSignedAssetUrl(storagePath, 3600) : null;

    logRouteSuccess(ROUTE_NAME);
    return NextResponse.json({ audioUrl });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "Unable to generate narration.");
    if (response) {
      return response;
    }

    const message = error instanceof Error ? error.message : "Unable to generate narration.";
    const status = message.includes("Missing ELEVENLABS") ? 503 : 500;
    return NextResponse.json({ audioUrl: null, error: message }, { status });
  }
}
