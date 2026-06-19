import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { buildFullBookNarrationScript, buildPageNarrationText } from "@/lib/bookNarration";
import { downloadAssetBuffer } from "@/lib/bookAssets";
import { generateNarrationAudioBuffer } from "@/lib/elevenlabs";
import {
  getBookByAccessToken,
  markMp3Failed,
  markMp3Generating,
  markMp3Ready,
  uploadBookMp3,
} from "@/lib/bookStore";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { concatMp3Buffers } from "@/lib/mp3Merge";
import type { LoreBook } from "@/lib/types";

async function resolvePageAudioBuffer(
  page: LoreBook["pages"][number],
  storedAudioRef?: string,
) {
  if (storedAudioRef) {
    const storedBuffer = await downloadAssetBuffer(storedAudioRef);
    if (storedBuffer) {
      return storedBuffer;
    }
  }

  if (page.audioUrl) {
    const inlineBuffer = await downloadAssetBuffer(page.audioUrl);
    if (inlineBuffer) {
      return inlineBuffer;
    }
  }

  const narrationText = buildPageNarrationText(page);
  return generateNarrationAudioBuffer(narrationText);
}

export async function generateFullBookMp3(bookId: string, book: LoreBook, audioMap: Record<string, string>) {
  await markMp3Generating(bookId);

  try {
    const buffers: Buffer[] = [];
    const introText = buildFullBookNarrationScript(book).split("\n\n")[0];
    if (introText) {
      const introBuffer = await generateNarrationAudioBuffer(introText);
      if (introBuffer) {
        buffers.push(introBuffer);
      }
    }

    for (let pageNumber = 1; pageNumber <= FULL_BOOK_PAGE_COUNT; pageNumber += 1) {
      const page = book.pages.find((item) => item.pageNumber === pageNumber);
      if (!page) {
        continue;
      }

      const pageBuffer = await resolvePageAudioBuffer(page, audioMap[String(pageNumber)]);
      if (!pageBuffer) {
        throw new Error(`Unable to prepare narration for page ${pageNumber}.`);
      }

      buffers.push(pageBuffer);
    }

    const mergedMp3 = concatMp3Buffers(buffers);
    const storagePath = await uploadBookMp3(bookId, mergedMp3);
    await markMp3Ready(bookId, storagePath);
    return storagePath;
  } catch (error) {
    await markMp3Failed(bookId);
    throw error;
  }
}

export async function ensureFullBookMp3(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  if (storedBook.mp3_status === "generating") {
    throw new Error("Narration is still being prepared.");
  }

  if (storedBook.mp3_status === "ready" && storedBook.mp3_storage_path) {
    return storedBook.mp3_storage_path;
  }

  const sourceBook = storedBook.full_book || storedBook.free_book;
  if (!sourceBook) {
    throw new Error("Book content is missing.");
  }

  return generateFullBookMp3(storedBook.id, sourceBook, storedBook.audio);
}
