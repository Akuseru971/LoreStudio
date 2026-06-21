import { NextResponse } from "next/server";
import { createSignedMp3Url, getBookByAccessToken } from "@/lib/bookStore";
import { ensureFullBookMp3 } from "@/lib/fullNarration";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
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

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to create MP3 download URL.", error);
    const message = error instanceof Error ? error.message : "Unable to download narration.";
    const status = message.includes("still being prepared") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
