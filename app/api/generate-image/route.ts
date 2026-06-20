import { NextResponse } from "next/server";
import { FREE_IMAGE_PAGE_COUNT } from "@/lib/image-config";
import { buildFallbackIllustration, generateBookPageImage } from "@/lib/images";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { book?: LoreBook; pageNumber?: number };
    const pageNumber = body.pageNumber;
    if (
      !body.book ||
      typeof pageNumber !== "number" ||
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > FREE_IMAGE_PAGE_COUNT
    ) {
      return NextResponse.json({ imageUrl: null, error: "Invalid image request." }, { status: 400 });
    }

    const book = normalizeLoreBook(body.book);
    const page = book.pages[pageNumber - 1];
    const imageUrl = process.env.OPENAI_API_KEY
      ? await generateBookPageImage(book, page, {
          fallbackOnFailure: true,
          maxAttempts: 2,
        })
      : buildFallbackIllustration(book, page);

    return NextResponse.json({ imageUrl: imageUrl || null });
  } catch (error) {
    console.warn("Image route failed.", error);
    return NextResponse.json({ imageUrl: null });
  }
}
