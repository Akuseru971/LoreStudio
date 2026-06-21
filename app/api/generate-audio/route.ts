import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { sanitizeText } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const audioUrl = await generateNarrationAudio(text, { pageNumber });
    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.warn("Narration route failed.", error);
    const message = error instanceof Error ? error.message : "Unable to generate narration.";
    const status = message.includes("Missing ELEVENLABS") ? 503 : 500;
    return NextResponse.json({ audioUrl: null, error: message }, { status });
  }
}
