import { NextResponse } from "next/server";
import { createSignedPdfUrl, getBookByAccessToken } from "@/lib/bookStore";

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

    if (storedBook.status !== "ready") {
      return NextResponse.json({ error: "Your book is not ready for download yet." }, { status: 409 });
    }

    if (!storedBook.pdf_storage_path) {
      return NextResponse.json({ error: "PDF is not available yet." }, { status: 404 });
    }

    const url = await createSignedPdfUrl(storedBook.pdf_storage_path, 3600);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to create PDF download URL.", error);
    const message = error instanceof Error ? error.message : "Unable to download PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
