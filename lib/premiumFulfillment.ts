import "server-only";

import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import { buildPageNarrationText } from "@/lib/bookNarration";
import {
  getBookByAccessToken,
  markBookFailed,
  mergeBookAssets,
  saveFullBook,
  uploadBookPdf,
} from "@/lib/bookStore";
import { finalizeBookIfReady } from "@/lib/bookCompletion";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { ensureAllBookImagesReady } from "@/lib/premiumImages";
import { normalizeStoredBookImages } from "@/lib/book-images";
import { generateBookPdf } from "@/lib/pdf";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

async function generatePremiumAudio(book: LoreBook) {
  const audio: Record<string, string> = {};
  const pages = [...book.pages];

  for (let pageNumber = ILLUSTRATED_PAGE_COUNT + 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
    const page = pages[pageNumber - 1];
    if (!page) {
      continue;
    }

    const audioUrl = await generateNarrationAudio(buildPageNarrationText(page), { pageNumber });
    if (audioUrl) {
      audio[String(pageNumber)] = audioUrl;
      pages[pageNumber - 1] = { ...page, audioUrl };
    }
  }

  for (let pageNumber = 1; pageNumber <= ILLUSTRATED_PAGE_COUNT; pageNumber += 1) {
    const page = pages[pageNumber - 1];
    if (!page?.audioUrl) {
      const audioUrl = await generateNarrationAudio(buildPageNarrationText(page), { pageNumber });
      if (audioUrl) {
        audio[String(pageNumber)] = audioUrl;
        pages[pageNumber - 1] = { ...page, audioUrl };
      }
    }
  }

  return {
    book: normalizeLoreBook({ ...book, pages }),
    audio,
  };
}

export async function fulfillPremiumBook(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (storedBook.status === "ready") {
    return storedBook;
  }

  if (!storedBook.free_book) {
    throw new Error("Free book data is missing.");
  }

  try {
    const baseBook = await mergeBookAssets(storedBook.free_book, storedBook.images, storedBook.audio);
    const { book: audioBook, audio } = await generatePremiumAudio(baseBook);

    await saveFullBook(storedBook.id, audioBook, { audio });

    const { book: illustratedBook } = await ensureAllBookImagesReady(accessToken);
    const latestBook = await getBookByAccessToken(accessToken);
    const normalized = latestBook ? normalizeStoredBookImages(latestBook) : null;
    const pdfBuffer = await generateBookPdf(illustratedBook, {
      images: normalized?.images || latestBook?.images,
      imageStatus: normalized?.imageStatus || latestBook?.image_status,
    });
    await uploadBookPdf(storedBook.id, pdfBuffer);

    await finalizeBookIfReady(accessToken);
    const readyBook = await getBookByAccessToken(accessToken);
    return readyBook || storedBook;
  } catch (error) {
    await markBookFailed(storedBook.id);
    throw error;
  }
}
