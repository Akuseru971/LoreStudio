/** Pages that receive generated images before payment. */
export const FREE_IMAGE_PAGE_COUNT = 4;

/** First page number that receives premium-only image generation. */
export const PREMIUM_IMAGE_START_PAGE = 5;

/** Pages that receive generated images only after payment. */
export const PREMIUM_IMAGE_PAGE_NUMBERS = [5, 6, 7, 8] as const;

export function isFreeImagePage(pageNumber: number) {
  return pageNumber >= 1 && pageNumber <= FREE_IMAGE_PAGE_COUNT;
}

export function isPremiumImagePage(pageNumber: number) {
  return (PREMIUM_IMAGE_PAGE_NUMBERS as readonly number[]).includes(pageNumber);
}

export function isSealedFreeImagePage(pageNumber: number) {
  return pageNumber === 5;
}
