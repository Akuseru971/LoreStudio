import { NextResponse } from "next/server";
import { generatePremiumImages } from "@/lib/premiumImages";

export const runtime = "nodejs";
export const maxDuration = 300;

type GeneratePremiumImagesBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
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
    const httpStatus = result.routeStatus === "failed" ? 500 : result.routeStatus === "partial" ? 207 : 200;

    return NextResponse.json(
      {
        success: result.routeStatus !== "failed",
        bookId: result.book.id,
        accessToken: body.accessToken,
        status: result.routeStatus,
        allReady: result.allReady,
        readyImagesCount: result.readyImagesCount,
        generatedPages: result.generatedPages,
        failedPages: result.failedPages,
        skippedPages: result.skippedPages,
        images: result.images,
      },
      { status: httpStatus },
    );
  } catch (error) {
    console.error("Premium image generation failed.", error);
    const message = error instanceof Error ? error.message : "Unable to generate premium images.";
    const status = message.includes("Premium access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
