import { clsx, type ClassValue } from "clsx";
import type { BookFormInput, LoreBook } from "@/lib/types";

export const genders = ["man", "woman", "creature", "unknown"] as const;

export const archetypes = [
  "warrior",
  "mage",
  "assassin",
  "king",
  "queen",
  "wanderer",
  "monster",
  "oracle",
  "thief",
  "guardian",
] as const;

export const tones = ["heroic", "tragic", "mysterious", "dark", "noble", "cursed"] as const;

export const universeStyles = [
  "dark fantasy",
  "anime fantasy",
  "gothic",
  "cosmic",
  "crime fantasy",
] as const;

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function validateBookInput(body: unknown): { input?: BookFormInput; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request." };
  }

  const source = body as Partial<Record<keyof BookFormInput, unknown>>;
  const name = sanitizeText(source.name, 40);
  const strength = sanitizeText(source.strength, 80);
  const weakness = sanitizeText(source.weakness, 80);
  const gender = source.gender;
  const archetype = sanitizeText(source.archetype, 40);
  const tone = sanitizeText(source.tone, 40);
  const universeStyle = sanitizeText(source.universeStyle, 40);

  if (!name || !strength || !weakness) {
    return { error: "Name, strength, and weakness are required." };
  }

  if (!genders.includes(gender as BookFormInput["gender"])) {
    return { error: "Invalid gender." };
  }

  if (!archetypes.includes(archetype as (typeof archetypes)[number])) {
    return { error: "Invalid archetype." };
  }

  if (!tones.includes(tone as (typeof tones)[number])) {
    return { error: "Invalid tone." };
  }

  if (!universeStyles.includes(universeStyle as (typeof universeStyles)[number])) {
    return { error: "Invalid universe style." };
  }

  return {
    input: {
      name,
      gender: gender as BookFormInput["gender"],
      archetype,
      tone,
      universeStyle,
      strength,
      weakness,
    },
  };
}

export function normalizeLoreBook(book: LoreBook): LoreBook {
  const expectedChapters = [
    "The Name",
    "Origin",
    "The Wound",
    "The Sign",
    "The Trial",
    "The Enemy",
    "The Transformation",
    "The Final Prophecy",
  ];

  return {
    ...book,
    pages: expectedChapters.map((chapter, index) => {
      const page = book.pages?.[index];

      return {
        pageNumber: index + 1,
        chapter,
        title: sanitizeText(page?.title, 80) || chapter,
        text: sanitizeText(page?.text, 700) || "The page remains veiled, waiting for the ink to return.",
        imagePrompt:
          sanitizeText(page?.imagePrompt, 1600) ||
          `Full-page illustration for ${chapter}, ancient archive atmosphere, dark fantasy protagonist.`,
        imageUrl: page?.imageUrl,
        audioUrl: page?.audioUrl,
      };
    }),
  };
}

export function dataUrlFromBase64(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}
