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

export const runeterraRegions = [
  "Auto",
  "Demacia",
  "Noxus",
  "Ionia",
  "Piltover",
  "Zaun",
  "Shurima",
  "Freljord",
  "Bilgewater",
  "Targon",
  "Ixtal",
  "Shadow Isles",
  "Bandle City",
  "The Void",
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
  const runeterraRegion = sanitizeText(source.runeterraRegion, 40) || "Auto";

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

  if (!runeterraRegions.includes(runeterraRegion as BookFormInput["runeterraRegion"])) {
    return { error: "Invalid Runeterra region." };
  }

  return {
    input: {
      name,
      gender: gender as BookFormInput["gender"],
      archetype,
      tone,
      universeStyle,
      runeterraRegion: runeterraRegion as BookFormInput["runeterraRegion"],
      strength,
      weakness,
    },
  };
}

export function normalizeLoreBook(book: Partial<LoreBook>): LoreBook {
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
  const bible = book.characterBible || {
    name: "The Unnamed",
    legendaryTitle: "The Unwritten Legend",
    visualIdentity: "enigmatic dark fantasy protagonist",
    clothing: "weathered ceremonial cloak and ancient leather armor",
    faceAndBody: "solemn face, resilient posture, mysterious presence",
    aura: "quiet moonlit aura",
    symbolicObject: "an old sealed book",
    colorPalette: "deep navy, charcoal black, parchment, muted gold",
    worldRules: "Runeterra's old powers answer only to consequence, memory, and sacrifice.",
    region: "Runeterra",
    runeterraLoreAnchor: "An original Runeterran legend compatible with known regional conflicts.",
  };
  const mainRegion = sanitizeText(book.mainRegion, 80) || sanitizeText(bible.region, 80) || "Runeterra";

  return {
    ...book,
    title: sanitizeText(book.title, 120) || "The Book of the Unwritten Legend",
    subtitle: sanitizeText(book.subtitle, 180) || "A dark fantasy chronicle recovered from a silent archive.",
    mainRegion,
    narratorIntro:
      sanitizeText(book.narratorIntro, 260) ||
      "The archive opens with a low breath, and a forgotten name begins to glow.",
    characterBible: {
      name: sanitizeText(bible.name, 80) || "The Unnamed",
      legendaryTitle: sanitizeText(bible.legendaryTitle, 120) || "The Unwritten Legend",
      region: sanitizeText(bible.region, 80) || mainRegion,
      visualIdentity: sanitizeText(bible.visualIdentity, 260) || "enigmatic dark fantasy protagonist",
      clothing: sanitizeText(bible.clothing, 260) || "weathered ceremonial cloak and ancient leather armor",
      faceAndBody: sanitizeText(bible.faceAndBody, 260) || "solemn face, resilient posture, mysterious presence",
      aura: sanitizeText(bible.aura, 180) || "quiet moonlit aura",
      symbolicObject: sanitizeText(bible.symbolicObject, 180) || "an old sealed book",
      colorPalette: sanitizeText(bible.colorPalette, 180) || "deep navy, charcoal black, parchment, muted gold",
      worldRules:
        sanitizeText(bible.worldRules, 300) ||
        "Runeterra's old powers answer only to consequence, memory, and sacrifice.",
      runeterraLoreAnchor:
        sanitizeText(bible.runeterraLoreAnchor, 300) ||
        "An original Runeterran legend compatible with known regional conflicts.",
    },
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
