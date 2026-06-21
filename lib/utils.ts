import { clsx, type ClassValue } from "clsx";
import { validateApprovedSynopsis } from "@/lib/synopsisValidation";
import { sanitizeText } from "@/lib/sanitize-text";
import type { ApprovedSynopsis, BookFormInput } from "@/lib/types";

export { normalizeLoreBook } from "@/lib/lore-normalize";
export { sanitizeText } from "@/lib/sanitize-text";

export const genders = ["man", "woman", "creature", "unknown"] as const;

export const characterTypes = [
  "Warrior",
  "Mage",
  "Assassin",
  "Guardian",
  "Wanderer",
  "Inventor",
  "Healer",
  "Oracle",
  "Hunter",
  "Noble",
  "Thief",
  "Monster",
  "Spirit-Bound",
  "Soldier",
  "Scholar",
  "Pirate",
  "Chemtech Survivor",
  "Void-Touched",
  "Vastaya",
  "Ascended Disciple",
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

export function validateBookInput(body: unknown): { input?: BookFormInput; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request." };
  }

  const source = body as Partial<Record<keyof BookFormInput, unknown>>;
  const name = sanitizeText(source.name, 40);
  const gender = source.gender;
  const characterType = sanitizeText(source.characterType, 60);
  const runeterraRegion = sanitizeText(source.runeterraRegion, 40) || "Auto";

  if (!name) {
    return { error: "Name is required." };
  }

  if (!genders.includes(gender as BookFormInput["gender"])) {
    return { error: "Invalid gender." };
  }

  if (!characterTypes.includes(characterType as (typeof characterTypes)[number])) {
    return { error: "Invalid character type." };
  }

  if (!runeterraRegions.includes(runeterraRegion as BookFormInput["runeterraRegion"])) {
    return { error: "Invalid Runeterra region." };
  }

  return {
    input: {
      name,
      gender: gender as BookFormInput["gender"],
      characterType,
      runeterraRegion: runeterraRegion as BookFormInput["runeterraRegion"],
    },
  };
}

export function validateGenerateBookRequest(body: unknown): {
  input?: BookFormInput;
  approvedSynopsis?: ApprovedSynopsis | null;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request." };
  }

  const source = body as {
    formInput?: unknown;
    approvedSynopsis?: unknown;
    name?: unknown;
    gender?: unknown;
    characterType?: unknown;
    runeterraRegion?: unknown;
  };

  const inputSource = source.formInput ?? source;
  const { input, error } = validateBookInput(inputSource);
  if (!input) {
    return { error };
  }

  let approvedSynopsis: ApprovedSynopsis | null = null;
  if (source.approvedSynopsis !== undefined && source.approvedSynopsis !== null) {
    approvedSynopsis = validateApprovedSynopsis(source.approvedSynopsis);
    if (!approvedSynopsis) {
      return { error: "Invalid approved synopsis." };
    }
  }

  return { input, approvedSynopsis };
}

export function dataUrlFromBase64(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

export function stripBookAssets<T extends { pages: Array<{ imageUrl?: string; audioUrl?: string | null }> }>(book: T): T {
  const pages = Array.isArray(book.pages) ? book.pages : [];

  return {
    ...book,
    pages: pages.map(({ imageUrl: _imageUrl, audioUrl: _audioUrl, ...page }) => page),
  };
}
