import { NextResponse } from "next/server";
import { getBookByAccessToken, saveNormalizedBookImages } from "@/lib/bookStore";
import { getReadyIllustrationCount, normalizeBookImages, repairStoredBookImages } from "@/lib/book-images";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export const runtime = "nodejs";

type RepairBookImagesBody = {
  accessToken?: string;
};

export async function POST(request: Request) {
  let body: RepairBookImagesBody = {};

  try {
    body = (await request.json()) as RepairBookImagesBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  try {
    const storedBook = await getBookByAccessToken(body.accessToken);
    if (!storedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    if (!hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({ error: "Premium access is required." }, { status: 403 });
    }

    const repaired = await repairStoredBookImages(storedBook);
    const savedBook = await saveNormalizedBookImages(storedBook.id, repaired.images, repaired.imageStatus);
    const sourceBook = savedBook.full_book || savedBook.free_book;
    const images = normalizeBookImages({
      images: savedBook.images,
      imageStatus: savedBook.image_status,
      pages: sourceBook?.pages,
    });

    return NextResponse.json({
      readyIllustrationCount: getReadyIllustrationCount({
        images: savedBook.images,
        imageStatus: savedBook.image_status,
        pages: sourceBook?.pages,
      }),
      missingPages: repaired.missingPages,
      images,
      allReady: repaired.missingPages.length === 0,
    });
  } catch (error) {
    console.error("[REPAIR_BOOK_IMAGES_FAILED]", error);
    const message = error instanceof Error ? error.message : "Unable to repair book images.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
