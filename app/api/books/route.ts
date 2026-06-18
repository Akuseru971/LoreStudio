import { NextResponse } from "next/server";
import { createFreeBook } from "@/lib/bookStore";
import type { BookFormInput, LoreBook } from "@/lib/types";
import { normalizeLoreBook, validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";

type CreateBookBody = {
  input?: BookFormInput;
  book?: LoreBook;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBookBody;
    const { input, error } = validateBookInput(body.input);
    if (!input || !body.book) {
      return NextResponse.json({ error: error || "Invalid book payload." }, { status: 400 });
    }

    const book = normalizeLoreBook(body.book);
    const storedBook = await createFreeBook(input, book);

    return NextResponse.json({
      accessToken: storedBook.access_token,
      bookId: storedBook.id,
      status: storedBook.status,
    });
  } catch (error) {
    console.error("Failed to create free book.", error);
    const message = error instanceof Error ? error.message : "Unable to save the book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
