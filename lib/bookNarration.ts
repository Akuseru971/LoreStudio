import type { LoreBook } from "@/lib/types";
import { sanitizeText } from "@/lib/utils";

export function buildPageNarrationText(page: LoreBook["pages"][number]) {
  const title = sanitizeText(page.title, 120);
  const text = sanitizeText(page.text, 1200);
  return [title, text].filter(Boolean).join(". ");
}

export function buildFullBookNarrationScript(book: LoreBook) {
  const bible = book.characterBible;
  const intro = [
    sanitizeText(bible.name, 80),
    sanitizeText(bible.legendaryTitle, 120),
  ]
    .filter(Boolean)
    .join(". ");

  const pageSections = book.pages
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((page) => buildPageNarrationText(page))
    .filter(Boolean);

  return [intro, ...pageSections].filter(Boolean).join("\n\n");
}
