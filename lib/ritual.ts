import { ILLUSTRATED_PAGE_COUNT } from "@/lib/book-config";
import type { LoreBook } from "@/lib/types";

export type RitualPhase = "archive" | "character" | "pages" | "voice" | "binding" | "complete";

export type RitualStatus = {
  phase: RitualPhase;
  progress: number;
  message: string;
  loreReady: boolean;
  imagesReadyCount: number;
  totalImages: number;
  audioReadyCount: number;
  totalAudio: number;
  videoReady: boolean;
  loreFailed: boolean;
  bindingStartedAt: number | null;
};

export const RITUAL_TOTAL_IMAGES = ILLUSTRATED_PAGE_COUNT;
export const RITUAL_TOTAL_AUDIO = ILLUSTRATED_PAGE_COUNT;

export const PHASE_TITLES: Record<RitualPhase, string> = {
  archive: "The Archive Opens",
  character: "The Character Takes Shape",
  pages: "The First Pages Are Written",
  voice: "The Voice Awakens",
  binding: "The Video Is Being Bound",
  complete: "Your Legend Is Bound",
};

export const PHASE_MESSAGES: Record<RitualPhase, string[]> = {
  archive: [
    "Opening the forgotten archives…",
    "Searching for your name between buried pages…",
    "A region of Runeterra is answering…",
    "A region answers in silence…",
    "The first ink begins to move…",
    "The ink begins to move…",
  ],
  character: [
    "A life takes shape…",
    "Your place in Runeterra is being revealed…",
    "The first truth has surfaced…",
  ],
  pages: [
    "The first pages are being written…",
    "Scenes rise from the parchment…",
    "The illustrations are finding their light…",
  ],
  voice: [
    "The narrator awakens…",
    "Binding breath to ink…",
    "The pages are learning to speak…",
    "The narrator has found its voice…",
  ],
  binding: [
    "Your legend is being bound…",
    "Voice, image, and memory are becoming one…",
    "Do not close this page. The final binding is near…",
    "Your legend is almost ready. Do not close this page.",
  ],
  complete: ["Your legend is bound.", "The book is ready.", "Open the book."],
};

export const ALL_RELICS = [
  "Broken Crown",
  "Blue Flame",
  "Ancient Blade",
  "Watching Eye",
  "Silver Key",
  "Drowned Coin",
  "Frost Rune",
  "Hextech Spark",
  "Spirit Mask",
  "Sun Disk Fragment",
] as const;

export type RelicName = (typeof ALL_RELICS)[number];

const RELICS_BY_REGION: Record<string, RelicName[]> = {
  Demacia: ["Broken Crown", "Ancient Blade", "Silver Key", "Watching Eye"],
  Noxus: ["Ancient Blade", "Broken Crown", "Watching Eye", "Blue Flame"],
  Ionia: ["Spirit Mask", "Blue Flame", "Watching Eye", "Silver Key"],
  Piltover: ["Hextech Spark", "Silver Key", "Watching Eye", "Ancient Blade"],
  Zaun: ["Hextech Spark", "Drowned Coin", "Blue Flame", "Watching Eye"],
  Shurima: ["Sun Disk Fragment", "Ancient Blade", "Broken Crown", "Watching Eye"],
  Freljord: ["Frost Rune", "Ancient Blade", "Blue Flame", "Silver Key"],
  Bilgewater: ["Drowned Coin", "Ancient Blade", "Broken Crown", "Watching Eye"],
  Targon: ["Blue Flame", "Sun Disk Fragment", "Watching Eye", "Silver Key"],
  Ixtal: ["Sun Disk Fragment", "Spirit Mask", "Blue Flame", "Ancient Blade"],
  "Shadow Isles": ["Drowned Coin", "Watching Eye", "Blue Flame", "Broken Crown"],
  "Bandle City": ["Spirit Mask", "Silver Key", "Blue Flame", "Hextech Spark"],
  "The Void": ["Watching Eye", "Blue Flame", "Broken Crown", "Frost Rune"],
};

export function getRelicsForRegion(region: string): RelicName[] {
  return RELICS_BY_REGION[region] || ["Silver Key", "Ancient Blade", "Blue Flame", "Watching Eye"];
}

export function getRegionSealClass(region: string) {
  const map: Record<string, string> = {
    Demacia: "ritual-seal-demacia",
    Noxus: "ritual-seal-noxus",
    Ionia: "ritual-seal-ionia",
    Piltover: "ritual-seal-piltover",
    Zaun: "ritual-seal-zaun",
    Shurima: "ritual-seal-shurima",
    Freljord: "ritual-seal-freljord",
    Bilgewater: "ritual-seal-bilgewater",
    Targon: "ritual-seal-targon",
    Ixtal: "ritual-seal-ixtal",
    "Shadow Isles": "ritual-seal-shadow-isles",
    "Bandle City": "ritual-seal-bandle",
    "The Void": "ritual-seal-void",
  };
  return map[region] || "ritual-seal-default";
}

export function createInitialRitualStatus(): RitualStatus {
  return {
    phase: "archive",
    progress: 4,
    message: PHASE_MESSAGES.archive[0],
    loreReady: false,
    imagesReadyCount: 0,
    totalImages: RITUAL_TOTAL_IMAGES,
    audioReadyCount: 0,
    totalAudio: RITUAL_TOTAL_AUDIO,
    videoReady: false,
    loreFailed: false,
    bindingStartedAt: null,
  };
}

export function computeRitualPhase(status: RitualStatus): RitualPhase {
  if (status.phase === "complete") return "complete";
  if (status.bindingStartedAt || status.phase === "binding") return "binding";
  if (!status.loreReady) return "archive";

  const assetsDone = areAssetsComplete(status);
  if (assetsDone) return "binding";

  if (status.audioReadyCount > 0) return "voice";
  if (status.imagesReadyCount > 0) return "pages";
  return "character";
}

export function computeTargetProgress(status: RitualStatus): number {
  if (status.phase === "complete") return 100;

  let target = status.progress;

  if (!status.loreReady) {
    target = Math.max(target, 18);
  } else {
    target = Math.max(target, 24);
    const loreBonus = 16;
    target = Math.max(target, 20 + loreBonus);
  }

  const imageProgress = (status.imagesReadyCount / Math.max(status.totalImages, 1)) * 28;
  const audioProgress = (status.audioReadyCount / Math.max(status.totalAudio, 1)) * 18;

  target = Math.max(target, 40 + imageProgress);
  target = Math.max(target, 58 + audioProgress);

  const assetsDone =
    status.imagesReadyCount >= status.totalImages && status.audioReadyCount >= status.totalAudio;

  if (assetsDone) {
    target = Math.max(target, 78);
    if (status.bindingStartedAt) {
      const elapsed = Date.now() - status.bindingStartedAt;
      const bindingProgress = Math.min(18, (elapsed / 5000) * 18);
      target = Math.max(target, 78 + bindingProgress);
    }
  }

  if (status.videoReady) {
    target = 100;
  }

  return Math.min(99, target);
}

export function areAssetsComplete(status: RitualStatus) {
  return status.imagesReadyCount >= status.totalImages && status.audioReadyCount >= status.totalAudio;
}

export function generateFinalQuotes(book: LoreBook): string[] {
  const lastPage = book.pages[book.pages.length - 1];
  const name = book.characterBible.name;
  const hook = book.distinctiveHook;
  const region = book.mainRegion || book.characterBible.region;

  const candidates = [
    lastPage?.text
      ? `${lastPage.text.split(".").filter(Boolean).pop()?.trim() || ""}.`
      : "",
    `Some names are not remembered. They return.`,
    `The road did not end. It only learned ${name}'s footsteps.`,
    `What ${name} left behind was not silence, but a door.`,
    `${hook}.`,
    `In ${region}, legends do not end — they wait.`,
    book.narratorIntro ? book.narratorIntro.split(".").filter(Boolean)[0]?.trim() + "." : "",
    `The archive closed, but the story remained awake.`,
  ].filter((quote) => quote && quote.length > 12);

  const unique = Array.from(new Set(candidates));
  while (unique.length < 3) {
    unique.push(`The ink remembers what the world forgot.`);
  }

  return unique.slice(0, 3);
}

export function pickDefaultRelic(region: string): RelicName {
  return getRelicsForRegion(region)[0];
}

export function pickDefaultQuote(book: LoreBook): string {
  return generateFinalQuotes(book)[0];
}

export const BINDING_CHECKLIST = [
  { id: "lore", label: "Writing the legend" },
  { id: "images", label: "Painting the pages" },
  { id: "audio", label: "Preparing the narrator" },
  { id: "voice", label: "Binding voice to memory" },
  { id: "book", label: "Opening the cinematic book…" },
  { id: "video", label: "Rendering your final video…" },
] as const;
