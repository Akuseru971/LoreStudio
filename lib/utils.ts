import { clsx, type ClassValue } from "clsx";
import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

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

  const pages = expectedChapters.map((chapter, index) => {
    const page = book.pages?.[index];
    const visualDirection = normalizeVisualDirection(page, index + 1, mainRegion);

    return {
      pageNumber: index + 1,
      chapter,
      title: sanitizeText(page?.title, 80) || chapter,
      text: sanitizeText(page?.text, 700) || "The page remains veiled, waiting for the ink to return.",
      visualDirection,
      imagePrompt:
        sanitizeText(page?.imagePrompt, 1800) ||
        rewriteImagePromptFromVisualDirection(index + 1, chapter, chapter, visualDirection),
      imageUrl: page?.imageUrl,
      audioUrl: page?.audioUrl,
    };
  });

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
      sceneType: "intimate emotional wound scene",
      cameraShot: "medium environmental shot focused on body language and symbolic loss",
      characterAction: "the protagonist confronts loss, shame, exile, curse, or weakness through action",
      environment: `a ruined, empty, or abandoned place in ${region} tied to the wound`,
      keyObjects: ["broken object", "empty room", "long shadow"],
      mood: "grieving, tense, vulnerable",
      lighting: "low side light with heavy shadows",
    },
    4: {
      sceneType: "supernatural discovery scene",
      cameraShot: "over-the-shoulder or medium-wide shot focused on the omen",
      characterAction: "the protagonist discovers a sign, relic, omen, spirit, rune, vision, or forbidden symbol",
      environment: `a hidden or sacred location in ${region} where regional magic manifests`,
      keyObjects: ["glowing omen", "ancient relic", "reacting environment"],
      mood: "mysterious, awed, dangerous",
      lighting: "strange supernatural glow cutting through darkness",
    },
    5: {
      sceneType: "dynamic action trial scene",
      cameraShot: "dramatic medium-wide action shot with motion and perspective",
      characterAction: "the protagonist survives danger, crosses a battlefield, escapes, climbs, fights, or endures a trial",
      environment: `a hazardous trial ground in ${region}, filled with movement and regional danger`,
      keyObjects: ["weapon or relic", "storm or debris", "non-canon creature or hazard"],
      mood: "urgent, kinetic, perilous",
      lighting: "high contrast battle light with sparks, storm, or magical flare",
    },
    6: {
      sceneType: "enemy confrontation scene",
      cameraShot: "wide confrontation shot with protagonist and original enemy both visible",
      characterAction: "the protagonist faces an original lore-compatible threat across tense distance",
      environment: `a confrontation site in ${region} with opposing silhouettes and regional stakes`,
      keyObjects: ["enemy silhouette", "dividing light", "threat symbol"],
      mood: "tense, threatening, monumental",
      lighting: "opposing light sources separating hero and enemy",
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
    "No repeated portrait composition, no repeated background, no repeated camera angle, no generic character standing pose, no simple bust shot, no text, no logo, no watermark.",
  ].join(" ");
}
