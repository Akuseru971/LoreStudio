import { cleanGeneratedText } from "@/lib/clean-generated-text";

const IMMERSION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bchoices made on page \d+\b/gi, "choices made that night"],
  [/\bthe name on page \d+\b/gi, "the name he had heard in the tunnels"],
  [/\bon page \d+\b/gi, ""],
  [/\bfrom page \d+\b/gi, ""],
  [/\bto page \d+\b/gi, ""],
  [/\bpage \d+\b/gi, ""],
  [/\bthis page\b/gi, "this moment"],
  [/\bthe previous page\b/gi, "what came before"],
  [/\bthe next page\b/gi, "what followed"],
  [/\bthis biography\b/gi, "this life"],
  [/\bthe biography\b/gi, "the chronicle"],
  [/\bhis biography\b/gi, "his life"],
  [/\bher biography\b/gi, "her life"],
  [/\btheir biography\b/gi, "their life"],
  [/\bstory structure\b/gi, ""],
  [/\bnarrative structure\b/gi, ""],
  [/\bpaid section\b/gi, ""],
  [/\bpaid continuation\b/gi, ""],
  [/\bthe reader\b/gi, ""],
  [/\bthe user\b/gi, ""],
  [/\bgenerated story\b/gi, ""],
  [/\bthe prompt\b/gi, ""],
  [/\bas the biography continues\b/gi, "as the years went on"],
  [/\bthis chapter shows\b/gi, ""],
  [/\bthe story now reveals\b/gi, ""],
  [/\bthe trial began\b/gi, "the hearing began"],
  [/\bthe pattern broke\b/gi, "the plan failed"],
  [/\bthe pattern shifted\b/gi, "the route changed"],
  [/\bfate shifted\b/gi, "fortune turned"],
  [/\bthe omen arrived\b/gi, "the warning came"],
  [/\bthe shadow answered\b/gi, "the danger followed"],
  [/\bthe silence remembered\b/gi, "the silence held"],
  [/\bdestiny called\b/gi, "duty called"],
];

export const VISIBLE_TEXT_IMMERSION_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "on this page", pattern: /\bon this page\b/i },
  { label: "in the next page", pattern: /\bin the next page\b/i },
  { label: "on the next page", pattern: /\bon the next page\b/i },
  { label: "the previous page", pattern: /\bthe previous page\b/i },
  { label: "this page", pattern: /\bthis page\b/i },
  { label: "page number reference", pattern: /\bpage\s*\d+\b/i },
  { label: "this biography", pattern: /\bthis biography\b/i },
  { label: "the biography", pattern: /\bthe biography\b/i },
  { label: "the reader", pattern: /\bthe reader\b/i },
  { label: "the user", pattern: /\bthe user\b/i },
  { label: "the story continues", pattern: /\bthe story continues\b/i },
  { label: "the narrative", pattern: /\bthe narrative\b/i },
  { label: "generated", pattern: /\bgenerated\b/i },
  { label: "unlock", pattern: /\bunlock\b/i },
  { label: "paid section", pattern: /\bpaid section\b/i },
  { label: "payment", pattern: /\bpayment\b/i },
  { label: "paywall", pattern: /\bpaywall\b/i },
  { label: "AI reference", pattern: /\bAI\b/ },
  { label: "the prompt", pattern: /\bthe prompt\b/i },
  { label: "JSON reference", pattern: /\bJSON\b/i },
  { label: "story structure", pattern: /\bstory structure\b/i },
  { label: "narrative structure", pattern: /\bnarrative structure\b/i },
  { label: "paid continuation", pattern: /\bpaid continuation\b/i },
  { label: "chapter mechanics", pattern: /\bchapter mechanics\b/i },
  { label: "this chapter shows", pattern: /\bthis chapter shows\b/i },
];

const TITLE_IMMERSION_RULES = VISIBLE_TEXT_IMMERSION_RULES.filter(({ label }) =>
  [
    "on this page",
    "in the next page",
    "on the next page",
    "the previous page",
    "this page",
    "page number reference",
    "the reader",
    "the user",
    "generated",
    "unlock",
    "paid section",
    "payment",
    "paywall",
    "AI reference",
    "the prompt",
    "JSON reference",
    "story structure",
    "narrative structure",
    "paid continuation",
    "chapter mechanics",
    "this chapter shows",
  ].includes(label),
);

export type ImmersionViolation = {
  pageNumber: number;
  field: "title" | "text";
  offendingPhrases: string[];
  textPreview: string;
};

export type VisibleStoryPage = {
  pageNumber?: number;
  title?: string;
  text?: string;
};

export function findImmersionOffendingPhrases(
  text: string,
  rules: Array<{ label: string; pattern: RegExp }> = VISIBLE_TEXT_IMMERSION_RULES,
): string[] {
  if (!text?.trim()) {
    return [];
  }

  return rules.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

export function containsImmersiveBreak(text: string) {
  return findImmersionOffendingPhrases(text).length > 0;
}

export function collectBookImmersionViolations(book: { pages?: VisibleStoryPage[] }): ImmersionViolation[] {
  const violations: ImmersionViolation[] = [];

  book.pages?.forEach((page, index) => {
    const pageNumber = page.pageNumber ?? index + 1;
    const body = page.text || "";
    const title = page.title || "";

    const textPhrases = findImmersionOffendingPhrases(body);
    if (textPhrases.length > 0) {
      violations.push({
        pageNumber,
        field: "text",
        offendingPhrases: textPhrases,
        textPreview: body.slice(0, 500),
      });
    }

    const titlePhrases = findImmersionOffendingPhrases(title, TITLE_IMMERSION_RULES);
    if (titlePhrases.length > 0) {
      violations.push({
        pageNumber,
        field: "title",
        offendingPhrases: titlePhrases,
        textPreview: title.slice(0, 200),
      });
    }
  });

  return violations;
}

export function polishImmersiveStoryText(text: string, maxLength = 700) {
  let polished = cleanGeneratedText(text.replace(/\s+/g, " ").trim());

  for (const [pattern, replacement] of IMMERSION_REPLACEMENTS) {
    polished = polished.replace(pattern, replacement);
  }

  polished = polished
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  if (polished.length > maxLength) {
    polished = polished.slice(0, maxLength).trim();
  }

  return polished;
}

export function cleanVisibleStoryText(text: string, maxLength = 700) {
  return polishImmersiveStoryText(cleanGeneratedText(text), maxLength);
}

export function cleanBookVisibleText<T extends { pages?: Array<Record<string, unknown> & VisibleStoryPage> }>(
  book: T,
): T {
  if (!book.pages?.length) {
    return book;
  }

  return {
    ...book,
    pages: book.pages.map((page, index) => ({
      ...page,
      pageNumber: page.pageNumber ?? index + 1,
      title: cleanVisibleStoryText(String(page.title || ""), 80),
      text: cleanVisibleStoryText(String(page.text || ""), 700),
    })),
  };
}
