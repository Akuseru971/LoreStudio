import { NextResponse } from "next/server";
import { generateBookPageImage } from "@/lib/images";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ imageUrl: null });
    }

    const body = (await request.json()) as { book?: LoreBook; pageNumber?: number };
    const pageNumber = body.pageNumber;
    if (!body.book || typeof pageNumber !== "number" || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 8) {
      return NextResponse.json({ imageUrl: null, error: "Invalid image request." }, { status: 400 });
    }

    const book = normalizeLoreBook(body.book);
    const page = book.pages[pageNumber - 1];
    const imageUrl = await generateBookPageImage(book, page);

    return NextResponse.json({ imageUrl: imageUrl || null });
  } catch (error) {
    console.warn("Image route failed.", error);
    return NextResponse.json({ imageUrl: null });
  }
}
