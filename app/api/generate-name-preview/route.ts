import { NextResponse } from "next/server";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { sanitizeText } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    const name = sanitizeText(body.name, 40);

    if (!name || name.length < 2) {
      return NextResponse.json({ audioUrl: null, error: "Name is required." }, { status: 400 });
    }

    const previewText = `The archives have found ${name}.`;

    try {
      const audioUrl = await generateNarrationAudio(previewText);
      return NextResponse.json({ audioUrl });
    } catch (error) {
      console.warn("Name preview audio failed.", error);
      return NextResponse.json({ audioUrl: null });
    }
  } catch (error) {
    console.warn("Name preview route failed.", error);
    return NextResponse.json({ audioUrl: null });
  }
}
