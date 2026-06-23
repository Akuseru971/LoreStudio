import "server-only";

import { getBookByAccessToken, updateBookStatus } from "@/lib/bookStore";
import { hasPremiumAccess } from "@/lib/paymentVerification";

export async function startPremiumFulfillment(accessToken: string) {
  console.log("[FULFILL_BOOK_START]", accessToken);

  const storedBook = await getBookByAccessToken(accessToken);
  if (!storedBook) {
    throw new Error("Book not found.");
  }

  if (storedBook.status === "ready") {
    console.log("[FULFILL_BOOK_RETURNED]", { accessToken, status: storedBook.status, skipped: true });
    return storedBook;
  }

  if (!hasPremiumAccess(storedBook.status) && storedBook.status !== "paid") {
    throw new Error("Book is not paid.");
  }

  if (storedBook.status === "paid") {
    console.log("[FULFILL_BOOK_MARK_PREPARING]", storedBook.id);
    await updateBookStatus(storedBook.id, "preparing_assets");
  }

  const latestBook = await getBookByAccessToken(accessToken);
  if (!latestBook) {
    throw new Error("Book not found after preparing assets.");
  }

  console.log("[FULFILL_BOOK_RETURNED]", {
    accessToken,
    status: latestBook.status,
  });

  return latestBook;
}
