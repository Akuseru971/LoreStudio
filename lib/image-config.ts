/** Pages that receive generated images before payment (2 story pages + preview cover). */
export const FREE_IMAGE_PAGE_COUNT = 3;

export const FREE_PREVIEW_STORY_IMAGE_PAGES = [1, 2] as const;
export const FREE_PREVIEW_POSTER_IMAGE_KEY = "preview_poster";
export const FREE_PREVIEW_POSTER_STEP_INDEX = 2;
export const FREE_PREVIEW_EXPERIENCE_STEP_COUNT = 3;

/** Story pages generated during the free preview. Preview cover uses FREE_PREVIEW_POSTER_IMAGE_KEY. */
export const FREE_IMAGE_PAGES = [...FREE_PREVIEW_STORY_IMAGE_PAGES] as const;

/** First page number that receives premium-only image generation. */
export const PREMIUM_IMAGE_START_PAGE = 3;

/** Pages that receive generated images only after payment. */
export const PREMIUM_IMAGE_PAGE_NUMBERS = [3, 4, 5, 6, 7, 8] as const;

export const PREMIUM_IMAGE_PAGES = [...PREMIUM_IMAGE_PAGE_NUMBERS];

export function isFreeImagePage(pageNumber: number) {
  return pageNumber >= 1 && pageNumber <= FREE_IMAGE_PAGE_COUNT;
}

export function isPremiumImagePage(pageNumber: number) {
  return (PREMIUM_IMAGE_PAGE_NUMBERS as readonly number[]).includes(pageNumber);
}

export function isSealedFreeImagePage(pageNumber: number) {
  return pageNumber === 5;
}

export function isPremiumImageLockedBeforePayment(pageNumber: number) {
  return isPremiumImagePage(pageNumber) && !isSealedFreeImagePage(pageNumber);
}

export function isPreviewCoverImageKey(key: string) {
  return key === FREE_PREVIEW_POSTER_IMAGE_KEY;
}
