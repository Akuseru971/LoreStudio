import "server-only";

import { getBookByAccessToken } from "@/lib/bookStore";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export async function fulfillPremiumBook(accessToken: string) {
  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (!hasPremiumAccess(storedBook.status)) {
    throw new Error("Premium access is required.");
  }

  console.log("[FULFILL_BOOK_DEFERRED]", {
    bookId: storedBook.id,
    accessToken,
    message: "Asset generation is handled by step routes from the client.",
  });

  return storedBook;
}
