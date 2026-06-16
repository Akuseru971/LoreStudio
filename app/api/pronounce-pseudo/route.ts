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

    try {
      const audioUrl = await generateNarrationAudio(name);
      return NextResponse.json({ audioUrl });
    } catch (error) {
      console.warn("Pseudo pronunciation failed.", error);
      return NextResponse.json({ audioUrl: null });
    }
  } catch (error) {
    console.warn("Pseudo pronunciation route failed.", error);
    return NextResponse.json({ audioUrl: null });
  }
}
