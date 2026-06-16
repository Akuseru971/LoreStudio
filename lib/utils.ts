import { clsx, type ClassValue } from "clsx";
import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import type { BookFormInput, BookPage, ChampionConnection, LoreBook } from "@/lib/types";

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

export function normalizeLoreBook(book: Partial<LoreBook>): LoreBook {
  const bible = book.characterBible || {
    name: "The Unnamed",
    gender: "unknown",
    characterType: "Wanderer",
    legendaryTitle: "The Unwritten Legend",
    socialRole: "itinerant witness",
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
  const championConnection = normalizeChampionConnection(book.championConnection);

  const pages = Array.from({ length: 8 }, (_, index) => {
    const page = book.pages?.[index];
    const visualDirection = normalizeVisualDirection(page, index + 1, mainRegion);
    const generatedTitle = sanitizeText(page?.title, 80);
    const generatedChapter = sanitizeText(page?.chapter, 80);
    const storyLabel = generatedChapter || generatedTitle || `Part ${index + 1}`;

    return {
      pageNumber: index + 1,
      chapter: storyLabel,
      title: generatedTitle || storyLabel,
      text: sanitizeText(page?.text, 700) || "The page remains veiled, waiting for the ink to return.",
      visualDirection,
      imagePrompt:
        sanitizeText(page?.imagePrompt, 1800) ||
        rewriteImagePromptFromVisualDirection(index + 1, storyLabel, generatedTitle || storyLabel, visualDirection),
      imageUrl: page?.imageUrl,
      audioUrl: page?.audioUrl,
    };
  });

  return {
    ...book,
    title: sanitizeText(book.title, 120) || "The Book of the Unwritten Legend",
    subtitle: sanitizeText(book.subtitle, 180) || "A dark fantasy chronicle recovered from a silent archive.",
    mainRegion,
    championConnection,
    storyEngine:
      sanitizeText(book.storyEngine, 240) ||
      "A specific local duty pulls an ordinary Runeterran into a regional conflict.",
    protagonistRole: sanitizeText(book.protagonistRole, 160) || sanitizeText(bible.socialRole, 160) || "local witness",
    coreConflict:
      sanitizeText(book.coreConflict, 240) ||
      "A concrete regional problem forces the protagonist to choose what they are willing to protect.",
    distinctiveHook:
      sanitizeText(book.distinctiveHook, 240) ||
      "A personal object, craft, or secret makes the protagonist's path distinct.",
    narratorIntro:
      sanitizeText(book.narratorIntro, 260) ||
      "The archive opens with a low breath, and a forgotten name begins to glow.",
    characterBible: {
      name: sanitizeText(bible.name, 80) || "The Unnamed",
      gender: sanitizeText(bible.gender, 40) || "unknown",
      characterType: sanitizeText(bible.characterType, 80) || "Wanderer",
      legendaryTitle: sanitizeText(bible.legendaryTitle, 120) || "The Unwritten Legend",
      region: sanitizeText(bible.region, 80) || mainRegion,
      socialRole: sanitizeText(bible.socialRole, 160) || "local witness",
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
    pages: enforceImagePromptVariety(pages),
  };
}

export function dataUrlFromBase64(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

function normalizeVisualDirection(page: Partial<BookPage> | undefined, pageNumber: number, region: string) {
  const fallback = defaultVisualDirection(pageNumber, region);
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

function defaultVisualDirection(pageNumber: number, region: string): BookPage["visualDirection"] {
  const directions: Record<number, BookPage["visualDirection"]> = {
    1: {
      sceneType: "iconic cover image",
      cameraShot: "low-angle full-body or three-quarter silhouette shot",
      characterAction: "the protagonist stands before a symbolic regional backdrop as destiny gathers around them",
      environment: `a dramatic symbolic landmark of ${region}, with region-specific architecture and atmosphere`,
      keyObjects: ["symbolic relic", "regional landmark", "omens in the sky"],
      mood: "legendary, ominous, introductory",
      lighting: "strong rim light and dramatic dusk contrast",
    },
    2: {
      sceneType: "wide establishing origin scene",
      cameraShot: "wide shot with the protagonist small or medium within the environment",
      characterAction: "the young protagonist moves through their birthplace, shaped by local culture",
      environment: `birthplace or origin environment in ${region}, showing architecture, landscape, and daily life`,
      keyObjects: ["regional homes", "distant landmark", "childhood path"],
      mood: "formative, atmospheric, rooted",
      lighting: "soft dawn or misty morning light",
    },
    3: {
      sceneType: "champion connection scene",
      cameraShot: "medium environmental shot with indirect lore details",
      characterAction: "the protagonist reacts to a champion's influence through rumor, memory, object, or regional aftermath",
      environment: `a lived-in location in ${region} shaped by known Runeterra history and local consequence`,
      keyObjects: ["faction symbol", "rumor object", "regional clue", "distant banner"],
      mood: "attached, weighted, lore-rooted",
      lighting: "story-specific regional light with a subtle heroic or ominous echo",
    },
    4: {
      sceneType: "rising conflict scene",
      cameraShot: "medium-wide shot focused on mounting stakes",
      characterAction: "the protagonist realizes the personal conflict can no longer be avoided",
      environment: `a charged everyday or sacred place in ${region} where the problem becomes personal`,
      keyObjects: ["proof object", "witness", "closing path"],
      mood: "tense, inevitable, personal",
      lighting: "closing shadows with a sharp point of focus",
    },
    5: {
      sceneType: "cliffhanger suspense scene",
      cameraShot: "dramatic medium-wide shot frozen at the moment of revelation",
      characterAction: "the protagonist reaches the shocking beat that halts the story before continuation",
      environment: `a specific ${region} setting that makes the cliffhanger visually unmistakable`,
      keyObjects: ["revealed clue", "opened threshold", "impossible detail", "champion-linked symbol"],
      mood: "urgent, suspended, breathless",
      lighting: "high-contrast suspense light cutting through darkness at the final beat",
    },
    6: {
      sceneType: "consequence scene",
      cameraShot: "wide aftermath shot showing immediate fallout",
      characterAction: "the protagonist faces what the cliffhanger unleashed or exposed",
      environment: `a confrontation or revelation site in ${region} altered by the previous page's shock`,
      keyObjects: ["aftermath evidence", "new threat", "changed environment"],
      mood: "volatile, exposed, consequential",
      lighting: "unstable light with strong directional contrast",
    },
    7: {
      sceneType: "visual transformation scene",
      cameraShot: "medium or wide shot showing full transformation context",
      characterAction: "power awakens, armor changes, aura emerges, curse spreads, or destiny reveals itself",
      environment: `a charged regional setting in ${region} reacting to the protagonist's transformation`,
      keyObjects: ["activating symbolic object", "aura", "environmental reaction"],
      mood: "revelatory, powerful, unstable",
      lighting: "radiant power bloom with atmospheric depth",
    },
    8: {
      sceneType: "cinematic final prophecy scene",
      cameraShot: "epic wide shot from behind or distant side angle",
      characterAction: "the protagonist walks toward, stands before, or disappears into a legendary threshold",
      environment: `a prophetic horizon, portal, temple, mountain, ruins, sea, or shadowed place in ${region}`,
      keyObjects: ["open threshold", "distant destination", "prophetic sky"],
      mood: "mysterious, open-ended, cinematic",
      lighting: "vast twilight, celestial beam, or horizon glow",
    },
  };

  return directions[pageNumber] || directions[8];
}

function normalizeChampionConnection(connection?: Partial<ChampionConnection>): ChampionConnection {
  return {
    championName: sanitizeText(connection?.championName, 80) || "Unknown Champion",
    connectionType: sanitizeText(connection?.connectionType, 80) || "shared_region",
    connectionSummary:
      sanitizeText(connection?.connectionSummary, 320) ||
      "The protagonist's early life was quietly shaped by a known Runeterra legend without altering official canon.",
    canonSafetyNote:
      sanitizeText(connection?.canonSafetyNote, 320) ||
      "The connection is indirect, minor, and does not change the champion's established story.",
  };
}

function enforceImagePromptVariety(pages: BookPage[]) {
  const genericPattern = /\b(portrait|close-up|close up|bust|standing hero|heroic pose|standing)\b/i;
  const genericCount = pages.filter((page) => genericPattern.test(page.imagePrompt)).length;

  return pages.map((page) => {
    const prompt = sanitizeText(page.imagePrompt, 1800);
    const shouldRewrite =
      prompt.length < 180 ||
      /\b(generic portrait|simple portrait|face portrait|bust shot|standing hero|heroic pose)\b/i.test(prompt) ||
      (genericCount > 2 && genericPattern.test(prompt));

    return {
      ...page,
      imagePrompt: shouldRewrite
        ? rewriteImagePromptFromVisualDirection(page.pageNumber, page.chapter, page.title, page.visualDirection)
        : prompt,
    };
  });
}

function rewriteImagePromptFromVisualDirection(
  pageNumber: number,
  chapter: string,
  title: string,
  visualDirection: BookPage["visualDirection"],
) {
  return [
    `Full-page illustrated story scene for Page ${pageNumber}: ${chapter} - ${title}.`,
    `Scene type: ${visualDirection.sceneType}.`,
    `Camera shot: ${visualDirection.cameraShot}.`,
    `Character action: ${visualDirection.characterAction}.`,
    `Environment: ${visualDirection.environment}.`,
    `Key objects: ${visualDirection.keyObjects.join(", ")}.`,
    `Mood: ${visualDirection.mood}.`,
    `Lighting: ${visualDirection.lighting}.`,
    IMAGE_STYLE_LOCK,
    IMAGE_STYLE_AVOIDANCES,
    "No repeated portrait composition, no repeated background, no repeated camera angle, no generic character standing pose, no simple bust shot.",
  ].join(" ");
}
