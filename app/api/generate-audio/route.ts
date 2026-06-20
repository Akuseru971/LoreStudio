import { NextResponse } from "next/server";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { sanitizeText } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown; pageNumber?: unknown };
    const text = sanitizeText(body.text, 900);
    const pageNumber = Number(body.pageNumber);

    if (!text || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 8) {
      return NextResponse.json({ audioUrl: null, error: "Invalid narration request." }, { status: 400 });
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
