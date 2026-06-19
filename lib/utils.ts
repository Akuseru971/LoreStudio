import { clsx, type ClassValue } from "clsx";
import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import { polishImmersiveStoryText } from "@/lib/immersive-text";
import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

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
  const fallbackChapterLabels = [
    "A Name in the Ledger",
    "The Work and the Ward",
    "The Day the Pattern Broke",
    "A Champion's Shadow",
    "The Door That Would Not Stay Shut",
    "What the Silence Left Behind",
    "The Person They Had to Become",
    "Where the Road Ends Now",
  ];
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

  const pages = fallbackChapterLabels.map((fallbackChapter, index) => {
    const page = book.pages?.[index];
    const visualDirection = normalizeVisualDirection(page, index + 1, mainRegion);
    const chapter = sanitizeText(page?.chapter, 80) || fallbackChapter;

    return {
      pageNumber: index + 1,
      chapter: polishImmersiveStoryText(sanitizeText(page?.chapter, 80) || fallbackChapter, 80),
      title: polishImmersiveStoryText(sanitizeText(page?.title, 80) || fallbackChapter, 80),
      text:
        polishImmersiveStoryText(
          sanitizeText(page?.text, 700) || "The page remains veiled, waiting for the ink to return.",
        ) || "The page remains veiled, waiting for the ink to return.",
      continuityNote: sanitizeText(page?.continuityNote, 240) || undefined,
      visualDirection,
      imagePrompt:
        sanitizeText(page?.imagePrompt, 1800) ||
        rewriteImagePromptFromVisualDirection(index + 1, chapter, chapter, visualDirection),
      imageUrl: page?.imageUrl,
      audioUrl: page?.audioUrl,
    };
  });

  const sourceBiographyArc = book.biographyArc;
  const biographyArc = {
    startingSituation:
      sanitizeText(sourceBiographyArc?.startingSituation, 300) ||
      sanitizeText(book.protagonistRole, 240) ||
      "An ordinary Runeterran with a clear local role.",
    incitingEvent:
      sanitizeText(sourceBiographyArc?.incitingEvent, 300) ||
      sanitizeText(book.coreConflict, 240) ||
      "A concrete event disrupts their daily life.",
    championConnectionPage4:
      sanitizeText(sourceBiographyArc?.championConnectionPage4, 300) ||
      sanitizeText(book.championConnection?.connectionSummary, 300) ||
      "A canon-safe connection to a regional champion shapes their path.",
    page5Cliffhanger:
      sanitizeText(sourceBiographyArc?.page5Cliffhanger, 300) || "A discovery forces an irreversible next step.",
    finalState:
      sanitizeText(sourceBiographyArc?.finalState, 300) ||
      sanitizeText(book.distinctiveHook, 240) ||
      "Their life has changed, but the road ahead remains open.",
  };

  const sourceChampionConnection = book.championConnection;
  const championConnection = {
    championName: sanitizeText(sourceChampionConnection?.championName, 80) || "A regional champion",
    connectionType: sanitizeText(sourceChampionConnection?.connectionType, 160) || "indirect influence",
    connectionSummary:
      sanitizeText(sourceChampionConnection?.connectionSummary, 300) || biographyArc.championConnectionPage4,
    canonSafetyNote:
      sanitizeText(sourceChampionConnection?.canonSafetyNote, 300) ||
      "The protagonist remains original and no major canon events were altered.",
  };

  const sourceOriginalityProfile = book.originalityProfile;
  const originalityProfile = {
    specificRole:
      sanitizeText(sourceOriginalityProfile?.specificRole, 160) ||
      sanitizeText(book.protagonistRole, 160) ||
      sanitizeText(bible.socialRole, 160) ||
      "local witness",
    dailyReality:
      sanitizeText(sourceOriginalityProfile?.dailyReality, 240) ||
      "ordinary work, routes, and obligations before the trouble began",
    regionalPressure:
      sanitizeText(sourceOriginalityProfile?.regionalPressure, 240) ||
      sanitizeText(book.coreConflict, 240) ||
      "a concrete regional problem",
    unusualStoryElement:
      sanitizeText(sourceOriginalityProfile?.unusualStoryElement, 240) ||
      sanitizeText(book.distinctiveHook, 240) ||
      "a personal object tied to the conflict",
    repetitionAvoided: Array.isArray(sourceOriginalityProfile?.repetitionAvoided)
      ? sourceOriginalityProfile.repetitionAvoided.map((item) => sanitizeText(item, 120)).filter(Boolean).slice(0, 6)
      : ["generic chosen one", "prophecy arc", "nameless darkness"],
  };

  return {
    ...book,
    title: sanitizeText(book.title, 120) || "The Book of the Unwritten Legend",
    subtitle: sanitizeText(book.subtitle, 180) || "A Runeterra biography recovered from a silent archive.",
    mainRegion,
    storyEngine:
      sanitizeText(book.storyEngine, 240) ||
      "A clear local duty pulls an ordinary Runeterran into a sequence of concrete events.",
    protagonistRole: sanitizeText(book.protagonistRole, 160) || sanitizeText(bible.socialRole, 160) || "local witness",
    coreConflict:
      sanitizeText(book.coreConflict, 240) ||
      "A concrete regional problem forces the protagonist to choose what they are willing to protect.",
    distinctiveHook:
      sanitizeText(book.distinctiveHook, 240) ||
      "A personal object, craft, or secret makes the protagonist's path distinct.",
    narratorIntro: polishImmersiveStoryText(
      sanitizeText(book.narratorIntro, 260) ||
        "The archive opens with a name, a place, and the first ordinary day that would not stay ordinary.",
      260,
    ),
    biographyArc: {
      startingSituation: biographyArc.startingSituation,
      incitingEvent: biographyArc.incitingEvent,
      championConnectionPage4: biographyArc.championConnectionPage4,
      page5Cliffhanger: biographyArc.page5Cliffhanger,
      finalState: biographyArc.finalState,
    },
    championConnection: {
      championName: championConnection.championName,
      connectionType: championConnection.connectionType,
      connectionSummary: championConnection.connectionSummary,
      canonSafetyNote: championConnection.canonSafetyNote,
    },
    originalityProfile,
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

export function stripBookAssets<T extends { pages: Array<{ imageUrl?: string; audioUrl?: string | null }> }>(book: T): T {
  return {
    ...book,
    pages: book.pages.map(({ imageUrl: _imageUrl, audioUrl: _audioUrl, ...page }) => page),
  };
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
      sceneType: "biography introduction scene",
      cameraShot: "medium-wide shot showing role and place",
      characterAction: "the protagonist is shown in their starting situation, work, or community role",
      environment: `a recognizable everyday location in ${region} tied to the protagonist's social role`,
      keyObjects: ["work tools", "local architecture", "personal detail"],
      mood: "clear, grounded, introductory",
      lighting: "natural regional daylight with readable detail",
    },
    2: {
      sceneType: "early life establishing scene",
      cameraShot: "wide shot with the protagonist within daily life",
      characterAction: "the protagonist moves through routine work, family, community, or duty",
      environment: `homes, workshops, streets, fields, docks, or shrines of ${region}`,
      keyObjects: ["community life", "daily tools", "regional landmarks"],
      mood: "lived-in, observant, specific",
      lighting: "soft morning or workday light",
    },
    3: {
      sceneType: "inciting event scene",
      cameraShot: "medium-wide action or discovery shot",
      characterAction: "the protagonist reacts to the first major event that changes their path",
      environment: `a concrete location in ${region} where the turning point happens`,
      keyObjects: ["broken object", "unexpected evidence", "changed environment"],
      mood: "alert, consequential, tense",
      lighting: "contrasty light emphasizing the incident",
    },
    4: {
      sceneType: "champion connection scene",
      cameraShot: "medium-wide shot focused on evidence, place, or indirect reference",
      characterAction: "the protagonist discovers or witnesses something tied to a known champion's influence",
      environment: `a location in ${region} affected by a champion's known history or faction`,
      keyObjects: ["faction symbol", "document", "aftermath", "distant banner or silhouette"],
      mood: "revealing, consequential, grounded",
      lighting: "clear light with one strong focal detail",
    },
    5: {
      sceneType: "cliffhanger scene",
      cameraShot: "dramatic medium-wide shot on the suspense moment",
      characterAction: "the protagonist reaches the cliffhanger discovery, threat, or impossible choice",
      environment: `the exact place in ${region} where the suspense peaks`,
      keyObjects: ["activating object", "opened door", "missing witness", "returning clue"],
      mood: "suspenseful, urgent, unresolved",
      lighting: "high-contrast light on the cliffhanger detail",
    },
    6: {
      sceneType: "immediate consequence scene",
      cameraShot: "medium-wide shot showing fallout",
      characterAction: "the protagonist deals with the direct result of the cliffhanger",
      environment: `a changed or exposed location in ${region}`,
      keyObjects: ["evidence of consequence", "new threat", "damaged place"],
      mood: "strained, reactive, pressing",
      lighting: "harsh or unstable light matching the fallout",
    },
    7: {
      sceneType: "personal change scene",
      cameraShot: "medium-wide shot showing growth through action",
      characterAction: "the protagonist acts differently because of what happened",
      environment: `a meaningful place in ${region} where the change becomes visible`,
      keyObjects: ["changed tool", "witnesses", "proof of growth"],
      mood: "earned, resolute, human",
      lighting: "warmer breakthrough light with depth",
    },
    8: {
      sceneType: "current fate scene",
      cameraShot: "wide cinematic shot with open horizon",
      characterAction: "the protagonist stands at their current place in life, facing an understandable open future",
      environment: `a road, harbor, shrine, workshop, ruin, or threshold in ${region}`,
      keyObjects: ["unfinished path", "personal object", "distant destination"],
      mood: "open-ended, clear, forward-looking",
      lighting: "twilight or horizon glow with readable atmosphere",
    },
  };

  return directions[pageNumber] || directions[8];
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
