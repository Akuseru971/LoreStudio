import { NextResponse } from "next/server";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { sanitizeText } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    const name = sanitizeText(body.name, 40);

    if (!name || name.length < 2) {
      return NextResponse.json({ audioUrl: null, error: "Invalid pseudo." }, { status: 400 });
    }

    const audioUrl = await generateNarrationAudio(name, { pageNumber: "preview" });
    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.warn("Pseudo pronunciation failed.", error);
    const message = error instanceof Error ? error.message : "Unable to generate pronunciation.";
    const status = message.includes("Missing ELEVENLABS") ? 503 : 500;
    return NextResponse.json({ audioUrl: null, error: message }, { status });
  }
}
