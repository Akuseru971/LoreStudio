import { NextResponse } from "next/server";
import { getBookByAccessToken } from "@/lib/bookStore";

export const runtime = "nodejs";

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

    return NextResponse.json({
      status: storedBook.status,
      accessToken: storedBook.access_token,
      canDownloadPdf: storedBook.status === "ready" && Boolean(storedBook.pdf_storage_path),
      characterName:
        storedBook.full_book?.characterBible.name || storedBook.free_book?.characterBible.name || null,
      title: storedBook.full_book?.title || storedBook.free_book?.title || null,
    });
  } catch (error) {
    console.error("Failed to load book status.", error);
    const message = error instanceof Error ? error.message : "Unable to load book status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
