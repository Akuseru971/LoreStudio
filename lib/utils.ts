import { clsx, type ClassValue } from "clsx";
import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import { polishImmersiveStoryText } from "@/lib/immersive-text";
import { isGenericPageTitle } from "@/lib/page-titles";
import { validateApprovedSynopsis } from "@/lib/synopsisValidation";
import type {
  ApprovedSynopsis,
  BookFormInput,
  BookPage,
  CharacterBible,
  ChampionConnection,
  LoreBook,
  StoryEngine,
  VisualBible,
  VisualDirection,
} from "@/lib/types";

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

type LegacyLoreBook = Partial<LoreBook> & {
  mainRegion?: string;
  protagonistRole?: string;
  coreConflict?: string;
  distinctiveHook?: string;
  narratorIntro?: string;
  biographyArc?: {
    startingSituation?: string;
    incitingEvent?: string;
    championConnectionPage5?: string;
    page5Cliffhanger?: string;
    finalState?: string;
  };
  originalityProfile?: {
    specificRole?: string;
    dailyReality?: string;
    regionalPressure?: string;
    unusualStoryElement?: string;
  };
  characterBible?: Partial<CharacterBible>;
  storyEngine?: Partial<StoryEngine> | string;
  championConnection?: Partial<ChampionConnection> & { connectionSummary?: string };
  visualBible?: Partial<VisualBible>;
  pages?: Array<Partial<BookPage> & { continuityNote?: string }>;
};

const FALLBACK_PAGE_TITLES = [
  "A Clerk in the Ledger Room",
  "Smoke Over the Lower Ward",
  "A Census Error at the Barracks",
  "The Harbor's False Saint",
  "Seven Names on a City Bill",
  "Orders from the Crimson Table",
  "The Surgeon Who Refused Glory",
  "A Bridge Still Unfinished",
];

export function normalizeLoreBook(book: LegacyLoreBook): LoreBook {
  const legacyBible = book.characterBible;
  const region =
    sanitizeText(book.region, 80) ||
    sanitizeText(book.mainRegion, 80) ||
    sanitizeText(legacyBible?.region, 80) ||
    "Runeterra";

  const title = sanitizeText(book.title, 120) || sanitizeText(legacyBible?.name, 80) || "The Unnamed";
  const subtitle =
    sanitizeText(book.subtitle, 180) || sanitizeText(legacyBible?.legendaryTitle, 120) || "A Runeterra biography";

  const storyEngine = normalizeStoryEngine(book, legacyBible, region);
  const championConnection = normalizeChampionConnection(book, storyEngine);
  const visualBible = normalizeVisualBible(book, legacyBible, region);
  const characterBible = buildCharacterBible(book, legacyBible, title, subtitle, region, storyEngine, visualBible);
  const pages = normalizePages(book.pages, region, visualBible);

  return {
    title,
    subtitle,
    region,
    genre: sanitizeText(book.genre, 80) || "in-world biography",
    storyEngine,
    championConnection,
    visualBible,
    pages,
    mainRegion: region,
    characterBible,
  };
}

function normalizeStoryEngine(
  book: LegacyLoreBook,
  legacyBible: Partial<CharacterBible> | undefined,
  region: string,
): StoryEngine {
  const source =
    typeof book.storyEngine === "object" && book.storyEngine !== null ? book.storyEngine : ({} as Partial<StoryEngine>);

  const archetype =
    sanitizeText(source.archetype, 160) ||
    (typeof book.storyEngine === "string" ? sanitizeText(book.storyEngine, 160) : "") ||
    "The Political Accident";

  return {
    archetype,
    centralIrony:
      sanitizeText(source.centralIrony, 300) ||
      sanitizeText(book.biographyArc?.startingSituation, 300) ||
      `In ${region}, ${legacyBible?.name || "the protagonist"} is remembered differently than they lived.`,
    publicReputation:
      sanitizeText(source.publicReputation, 240) ||
      sanitizeText(legacyBible?.legendaryTitle, 160) ||
      "a local figure spoken of with mixed reverence",
    privateTruth:
      sanitizeText(source.privateTruth, 240) ||
      sanitizeText(book.distinctiveHook, 240) ||
      "a truth they cannot safely speak aloud",
    socialPressure:
      sanitizeText(source.socialPressure, 240) ||
      sanitizeText(book.coreConflict, 240) ||
      sanitizeText(book.originalityProfile?.regionalPressure, 240) ||
      `the ordinary pressures of life in ${region}`,
    irreversibleEvent:
      sanitizeText(source.irreversibleEvent, 240) ||
      sanitizeText(book.biographyArc?.incitingEvent, 240) ||
      "one decision that could not be undone",
    championConnectionType:
      sanitizeText(source.championConnectionType, 240) ||
      sanitizeText(book.championConnection?.connectionType, 160) ||
      "collateral consequence of a champion's public legend",
    finalContradiction:
      sanitizeText(source.finalContradiction, 240) ||
      sanitizeText(book.biographyArc?.finalState, 240) ||
      "they became influential by remaining partly unknown",
  };
}

function normalizeChampionConnection(book: LegacyLoreBook, storyEngine: StoryEngine): ChampionConnection {
  const source = (book.championConnection || {}) as Partial<ChampionConnection>;

  return {
    championName: sanitizeText(source.championName, 80) || "A regional champion",
    connectionType:
      sanitizeText(source.connectionType, 160) || storyEngine.championConnectionType || "structural influence",
    connectionSummary:
      sanitizeText(source.connectionSummary, 300) ||
      sanitizeText(book.biographyArc?.championConnectionPage5, 300) ||
      "A champion's public history reshaped the world around the protagonist.",
    whyItMatters:
      sanitizeText(source.whyItMatters, 300) ||
      sanitizeText(source.connectionSummary, 300) ||
      "The champion never needed to appear; their legend was enough to change everything.",
    canonSafetyNote:
      sanitizeText(source.canonSafetyNote, 300) ||
      "The protagonist remains original and no major canon events were altered.",
  };
}

function normalizeVisualBible(
  book: LegacyLoreBook,
  legacyBible: Partial<CharacterBible> | undefined,
  region: string,
): VisualBible {
  const source = (book.visualBible || {}) as Partial<VisualBible>;

  return {
    appearance:
      sanitizeText(source.appearance, 300) ||
      sanitizeText(legacyBible?.visualIdentity, 260) ||
      sanitizeText(legacyBible?.faceAndBody, 260) ||
      "a weathered Runeterran with practical posture and watchful eyes",
    clothing:
      sanitizeText(source.clothing, 260) ||
      sanitizeText(legacyBible?.clothing, 260) ||
      "regional work clothes marked by daily labor",
    regionAtmosphere:
      sanitizeText(source.regionAtmosphere, 300) ||
      sanitizeText(legacyBible?.runeterraLoreAnchor, 300) ||
      `the lived atmosphere of ${region}`,
    colorPalette:
      sanitizeText(source.colorPalette, 180) ||
      sanitizeText(legacyBible?.colorPalette, 180) ||
      "deep navy, charcoal black, parchment, muted gold",
    recurringVisualMotif:
      sanitizeText(source.recurringVisualMotif, 180) ||
      sanitizeText(legacyBible?.symbolicObject, 180) ||
      "a personal object tied to their public reputation",
  };
}

function buildCharacterBible(
  book: LegacyLoreBook,
  legacyBible: Partial<CharacterBible> | undefined,
  title: string,
  subtitle: string,
  region: string,
  storyEngine: StoryEngine,
  visualBible: VisualBible,
): CharacterBible {
  return {
    name: sanitizeText(legacyBible?.name, 80) || title,
    gender: sanitizeText(legacyBible?.gender, 40) || "unknown",
    characterType: sanitizeText(legacyBible?.characterType, 80) || "Wanderer",
    legendaryTitle: subtitle,
    region,
    socialRole:
      sanitizeText(legacyBible?.socialRole, 160) ||
      sanitizeText(book.protagonistRole, 160) ||
      sanitizeText(book.originalityProfile?.specificRole, 160) ||
      storyEngine.publicReputation,
    visualIdentity: visualBible.appearance,
    clothing: visualBible.clothing,
    faceAndBody: visualBible.appearance,
    aura: sanitizeText(legacyBible?.aura, 180) || visualBible.regionAtmosphere,
    symbolicObject: visualBible.recurringVisualMotif,
    colorPalette: visualBible.colorPalette,
    worldRules:
      sanitizeText(legacyBible?.worldRules, 300) ||
      "Runeterra remembers people through consequence, reputation, and the stories others need to believe.",
    runeterraLoreAnchor: visualBible.regionAtmosphere,
  };
}

function normalizePages(
  sourcePages: LegacyLoreBook["pages"],
  region: string,
  visualBible: VisualBible,
): BookPage[] {
  return FALLBACK_PAGE_TITLES.map((fallbackTitle, index) => {
    const page = sourcePages?.[index];
    const rawTitle =
      sanitizeText(page?.title, 80) || sanitizeText(page?.chapter, 80) || fallbackTitle;
    const resolvedTitle = polishImmersiveStoryText(
      rawTitle && !isGenericPageTitle(rawTitle) ? rawTitle : fallbackTitle,
      80,
    );

    const normalizedPage: BookPage = {
      pageNumber: index + 1,
      chapter: resolvedTitle,
      title: resolvedTitle,
      text:
        polishImmersiveStoryText(
          sanitizeText(page?.text, 700) || "The page remains veiled, waiting for the ink to return.",
        ) || "The page remains veiled, waiting for the ink to return.",
      imagePrompt: sanitizeText(page?.imagePrompt, 1800) || "",
      imageUrl: page?.imageUrl,
      audioUrl: page?.audioUrl,
    };

    normalizedPage.visualDirection = normalizeVisualDirection(page, normalizedPage, region);
    normalizedPage.imagePrompt = ensureImagePrompt(normalizedPage, region, visualBible);
    return normalizedPage;
  });
}

function normalizeVisualDirection(
  page: Partial<BookPage> | undefined,
  normalizedPage: BookPage,
  region: string,
): VisualDirection {
  const fallback = defaultVisualDirection(normalizedPage, region);
  const source = page?.visualDirection;
  const keyObjects = Array.isArray(source?.keyObjects)
    ? source.keyObjects.map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, 5)
    : fallback.keyObjects;

  return {
    sceneType: sanitizeText(source?.sceneType, 120) || fallback.sceneType,
    cameraShot: sanitizeText(source?.cameraShot, 120) || fallback.cameraShot,
    characterAction: sanitizeText(source?.characterAction, 220) || fallback.characterAction,
    environment: sanitizeText(source?.environment, 220) || fallback.environment,
    keyObjects: keyObjects.length ? keyObjects : fallback.keyObjects,
    mood: sanitizeText(source?.mood, 120) || fallback.mood,
    lighting: sanitizeText(source?.lighting, 120) || fallback.lighting,
  };
}

function defaultVisualDirection(page: BookPage, region: string): VisualDirection {
  return {
    sceneType: "concrete biography moment",
    cameraShot: "medium-wide documentary scene",
    characterAction: `the protagonist in the event: ${page.title}`,
    environment: `a specific public or professional setting in ${region}`,
    keyObjects: ["regional architecture", "work tools", "witnesses or officials"],
    mood: "grounded, dramatic, specific",
    lighting: "natural regional light with readable detail",
  };
}

function ensureImagePrompt(page: BookPage, region: string, visualBible: VisualBible) {
  const prompt = sanitizeText(page.imagePrompt, 1800);
  const genericPattern = /\b(portrait|close-up|close up|bust|standing hero|heroic pose|glowing relic|sealed door|mysterious map|mist)\b/i;

  if (prompt.length >= 180 && !genericPattern.test(prompt)) {
    return prompt;
  }

  const direction = page.visualDirection || defaultVisualDirection(page, region);
  return [
    `Full-page illustrated biography scene for Page ${page.pageNumber}: ${page.title}.`,
    `Scene type: ${direction.sceneType}.`,
    `Camera shot: ${direction.cameraShot}.`,
    `Character action: ${direction.characterAction}.`,
    `Environment: ${direction.environment}.`,
    `Key objects: ${direction.keyObjects.join(", ")}.`,
    `Mood: ${direction.mood}.`,
    `Lighting: ${direction.lighting}.`,
    `Character appearance: ${visualBible.appearance}. Clothing: ${visualBible.clothing}.`,
    `Region atmosphere: ${visualBible.regionAtmosphere}. Palette: ${visualBible.colorPalette}.`,
    IMAGE_STYLE_LOCK,
    IMAGE_STYLE_AVOIDANCES,
    "Show a concrete social scene, not a generic fantasy poster.",
  ].join(" ");
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
