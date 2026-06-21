import { NextResponse } from "next/server";
import { getNarratorTeaserAudioUrl } from "@/lib/narrator-teaser";

export const runtime = "nodejs";

export async function POST() {
  try {
    const audioUrl = await getNarratorTeaserAudioUrl();
    if (!audioUrl) {
      return NextResponse.json({ audioUrl: null, error: "Unable to generate narrator teaser." }, { status: 503 });
    }

    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.warn("Narrator teaser route failed.", error);
    const message = error instanceof Error ? error.message : "Unable to generate narrator teaser.";
    return NextResponse.json({ audioUrl: null, error: message }, { status: 503 });
  }
}
