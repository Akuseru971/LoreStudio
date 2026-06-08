import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a master dark fantasy author, narrative designer, and art director.
You create personalized illustrated lore books.
You write cinematic, emotional, mysterious stories with clear narrative progression.
You never reference existing copyrighted franchises.
You output strict valid JSON only.`;

  const user = `Create a personalized illustrated lore book for this user:

Name: ${input.name}
Gender: ${input.gender}
Archetype: ${input.archetype}
Tone: ${input.tone}
Universe style: ${input.universeStyle}
Strength: ${input.strength}
Weakness: ${input.weakness}

Return a JSON object matching this exact schema:
{
  "title": "string",
  "subtitle": "string",
  "narratorIntro": "string",
  "characterBible": {
    "name": "string",
    "legendaryTitle": "string",
    "visualIdentity": "string",
    "clothing": "string",
    "faceAndBody": "string",
    "aura": "string",
    "symbolicObject": "string",
    "colorPalette": "string",
    "worldRules": "string"
  },
  "pages": [
    {
      "pageNumber": 1,
      "chapter": "The Name",
      "title": "string",
      "text": "string, 45 to 75 words",
      "imagePrompt": "string"
    }
  ]
}

Rules:
- Return exactly 8 pages.
- Page 1 chapter must be "The Name".
- Page 2 chapter must be "Origin".
- Page 3 chapter must be "The Wound".
- Page 4 chapter must be "The Sign".
- Page 5 chapter must be "The Trial".
- Page 6 chapter must be "The Enemy".
- Page 7 chapter must be "The Transformation".
- Page 8 chapter must be "The Final Prophecy".
- Each page text must be 45 to 75 words.
- The story must have a beginning, progression, conflict, transformation, and mysterious ending.
- The user must be the protagonist.
- The story must feel original.
- Do not mention AI, prompt, generated, OpenAI, image model, or any technical term.
- Do not use copyrighted world names, character names, places, factions, or brands.
- The imagePrompt for each page must describe a full-page illustration.
- Every imagePrompt must include the same characterBible details to keep visual consistency.
- Every imagePrompt must include: cinematic dark fantasy illustration, premium storybook art, dramatic lighting, coherent character design, no text, no logos, no watermark.
- The imagePrompt must avoid asking for written text inside the image.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const styleLock = `Consistent protagonist across all images: ${bible.visualIdentity}, ${bible.faceAndBody}, wearing ${bible.clothing}, aura: ${bible.aura}, symbolic object: ${bible.symbolicObject}, color palette: ${bible.colorPalette}. Cinematic dark fantasy premium storybook illustration, realistic painterly rendering, dramatic shadows, atmospheric fog, elegant composition, high detail, no text, no logo, no watermark.`;

  return [
    `Full-page book illustration for chapter ${page.pageNumber}: ${page.chapter} - ${page.title}.`,
    `Scene: ${page.imagePrompt}`,
    `World rules: ${bible.worldRules}`,
    styleLock,
    "Portrait composition suitable for a luxury parchment book page. Avoid typography, captions, signatures, brands, and interface elements.",
  ].join("\n");
}
