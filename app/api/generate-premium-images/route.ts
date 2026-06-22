import { NextResponse } from "next/server";
import { getReadyIllustrationCount } from "@/lib/book-images";
import {
  isClientConnectionClosedError,
  isRequestAborted,
  logClientConnectionClosed,
  clientConnectionClosedResponse,
  logRouteStart,
  logRouteSuccess,
  respondToRouteError,
} from "@/lib/api-route-utils";
import { generatePremiumImages } from "@/lib/premiumImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_NAME = "/api/generate-premium-images";

type GeneratePremiumImagesBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  logRouteStart(ROUTE_NAME, request);

  if (isRequestAborted(request)) {
    logClientConnectionClosed(ROUTE_NAME);
    return clientConnectionClosedResponse();
  }

  let body: GeneratePremiumImagesBody = {};

  try {
    body = (await request.json()) as GeneratePremiumImagesBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const result = await generatePremiumImages(body.accessToken);
    const readyImagesCount = getReadyIllustrationCount({
      images: result.book.images,
      imageStatus: result.book.image_status,
      pages: (result.book.full_book || result.book.free_book)?.pages,
    });

    logRouteSuccess(ROUTE_NAME);

    return NextResponse.json({
      success: true,
      accessToken: body.accessToken,
      status: result.book.status,
      allReady: result.allReady,
      readyImagesCount,
    });
  } catch (error) {
    if (isClientConnectionClosedError(error)) {
      logClientConnectionClosed(ROUTE_NAME);
      return clientConnectionClosedResponse();
    }

    const response = respondToRouteError(ROUTE_NAME, error, "Unable to generate premium images.");
    if (response) {
      return response;
    }

    const message = error instanceof Error ? error.message : "Unable to generate premium images.";
    const status = message.includes("Premium access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
