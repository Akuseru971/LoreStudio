import { FULL_BOOK_PAGE_COUNT, ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import {
  getBookByAccessToken,
  markBookFailed,
  markBookReady,
  mergeBookAssets,
  saveFullBook,
  updateBookStatus,
  uploadBookPdf,
} from "@/lib/bookStore";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { ensureAllBookImagesReady } from "@/lib/premiumImages";
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

    const audioUrl = await generateNarrationAudio(page.text);
    if (audioUrl) {
      audio[String(pageNumber)] = audioUrl;
      pages[pageNumber - 1] = { ...page, audioUrl };
    }
  }

  for (let pageNumber = 1; pageNumber <= ILLUSTRATED_PAGE_COUNT; pageNumber += 1) {
    const page = pages[pageNumber - 1];
    if (!page?.audioUrl) {
      const audioUrl = await generateNarrationAudio(page.text);
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

  if (storedBook.status === "ready" || storedBook.status === "generating") {
    return storedBook;
  }

  if (!storedBook.free_book) {
    throw new Error("Free book data is missing.");
  }

  await updateBookStatus(storedBook.id, "generating");

  try {
    const baseBook = await mergeBookAssets(storedBook.free_book, storedBook.images, storedBook.audio);
    const { book: audioBook, audio } = await generatePremiumAudio(baseBook);

    await saveFullBook(storedBook.id, audioBook, { audio });

    const { book: illustratedBook } = await ensureAllBookImagesReady(accessToken);
    const pdfBuffer = await generateBookPdf(illustratedBook);
    await uploadBookPdf(storedBook.id, pdfBuffer);

    const readyBook = await markBookReady(storedBook.id);
    return readyBook;
  } catch (error) {
    await markBookFailed(storedBook.id);
    throw error;
  }
}
