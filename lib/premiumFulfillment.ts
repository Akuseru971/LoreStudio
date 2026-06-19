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
import { sendBookReadyEmail } from "@/lib/email";
import { generateNarrationAudio } from "@/lib/elevenlabs";
import { generateBookPageImage } from "@/lib/images";
import { generateBookPdf } from "@/lib/pdf";
import type { LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

const FULL_PAGE_COUNT = FULL_BOOK_PAGE_COUNT;

async function generatePremiumAssets(book: LoreBook) {
  const images: Record<string, string> = {};
  const audio: Record<string, string> = {};
  const pages = [...book.pages];

  for (let pageNumber = ILLUSTRATED_PAGE_COUNT + 1; pageNumber <= FULL_PAGE_COUNT; pageNumber += 1) {
    const page = pages[pageNumber - 1];
    if (!page) {
      continue;
    }

    const imageUrl = await generateBookPageImage(book, page, {
      fallbackOnFailure: true,
      maxAttempts: 2,
    });
    if (imageUrl) {
      images[String(pageNumber)] = imageUrl;
      pages[pageNumber - 1] = { ...page, imageUrl };
    }

    const audioUrl = await generateNarrationAudio(page.text);
    if (audioUrl) {
      audio[String(pageNumber)] = audioUrl;
      pages[pageNumber - 1] = { ...pages[pageNumber - 1], audioUrl };
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
    images,
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

  await updateBookStatus(storedBook.id, "generating");

  try {
    const baseBook = await mergeBookAssets(storedBook.free_book, storedBook.images, storedBook.audio);
    const { book: fullBook, images, audio } = await generatePremiumAssets(baseBook);

    await saveFullBook(storedBook.id, fullBook, { images, audio });

    const pdfBuffer = await generateBookPdf(fullBook);
    await uploadBookPdf(storedBook.id, pdfBuffer);

    const readyBook = await markBookReady(storedBook.id);
    await sendBookReadyEmail(readyBook);
    return readyBook;
  } catch (error) {
    await markBookFailed(storedBook.id);
    throw error;
  }
}
