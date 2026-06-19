import { NextResponse } from "next/server";
import { getBookByAccessToken, mergeBookAssets } from "@/lib/bookStore";

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

    const isReady = storedBook.status === "ready";
    const sourceBook = isReady ? storedBook.full_book : storedBook.free_book;
    const book = sourceBook
      ? await mergeBookAssets(sourceBook, storedBook.images, storedBook.audio)
      : null;

    return NextResponse.json({
      status: storedBook.status,
      accessToken: storedBook.access_token,
      email: storedBook.email,
      book,
      canDownloadPdf: isReady && Boolean(storedBook.pdf_storage_path),
      pageCount: isReady ? 8 : 5,
    });
  } catch (error) {
    console.error("Failed to load book.", error);
    const message = error instanceof Error ? error.message : "Unable to load book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
