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
- The 8 pages must form a chronological life arc for the protagonist:
  1. Birth / naming: the protagonist's birth, first omen, and why their name matters.
  2. Childhood / origin: where they grew up, what shaped them, and the first visible traits of their archetype.
  3. Wound / weakness: the defining emotional wound, loss, curse, fear, or flaw that follows them.
  4. First sign: the first supernatural sign that destiny is watching them.
  5. Awakening / powers: the trial where they obtain or awaken their powers, relic, weapon, or forbidden gift.
  6. Enemy / conflict: the force opposing them, external and internal, tied to their weakness.
  7. Evolution / transformation: how they master the power and become a changed legendary figure.
  8. Final prophecy: an open-ended mysterious destiny that suggests the next chapter without resolving everything.
- Each page must clearly advance the protagonist's life and transformation. Do not write disconnected poetic fragments.
- Each page text must mention a concrete event, choice, or change in the protagonist's journey.
- Each page text must be 45 to 75 words.
- The story must have a beginning, progression, conflict, transformation, and mysterious ending.
- The user must be the protagonist.
- The story must feel original.
- Do not mention AI, prompt, generated, OpenAI, image model, or any technical term.
- Do not use copyrighted world names, character names, places, factions, or brands.
- The imagePrompt for each page must describe a full-page illustration.
- The imagePrompt must visually represent that page's exact life phase and event: birth, childhood, wound, omen, power awakening, enemy, transformation, or prophecy.
- Every imagePrompt must include the same characterBible details to keep visual consistency.
- Every imagePrompt must include: cinematic dark fantasy illustration, premium storybook art, dramatic lighting, coherent character design, no text, no logos, no watermark.
- The imagePrompt must avoid asking for written text inside the image.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const phase = pagePhase(page.pageNumber);
  const styleLock = `Consistent protagonist across all images: ${bible.visualIdentity}, ${bible.faceAndBody}, wearing ${bible.clothing}, aura: ${bible.aura}, symbolic object: ${bible.symbolicObject}, color palette: ${bible.colorPalette}. Cinematic dark fantasy premium storybook illustration, realistic painterly rendering, dramatic shadows, atmospheric fog, elegant composition, high detail, no text, no logo, no watermark.`;

  return [
    `Full-page book illustration for chapter ${page.pageNumber}: ${page.chapter} - ${page.title}.`,
    `Narrative phase to show visually: ${phase}.`,
    `Scene: ${page.imagePrompt}`,
    `World rules: ${bible.worldRules}`,
    styleLock,
    "The image must tell this exact story moment, not a generic portrait. Portrait composition suitable for a luxury parchment book page. Avoid typography, captions, signatures, brands, and interface elements.",
  ].join("\n");
}

function pagePhase(pageNumber: number) {
  const phases: Record<number, string> = {
    1: "birth, naming, first omen, and the first mark of destiny",
    2: "childhood, origin place, early hardship, and first traits of the chosen archetype",
    3: "the defining wound, fear, curse, or weakness that changes the protagonist",
    4: "the first supernatural sign proving destiny has noticed the protagonist",
    5: "awakening or obtaining powers, relic, weapon, forbidden gift, or magical authority",
    6: "meeting the enemy or central conflict tied to the protagonist's weakness",
    7: "evolution into a transformed legendary figure who begins mastering the power",
    8: "mysterious final prophecy and open-ended destiny beyond the last page",
  };

  return phases[pageNumber] || "chronological dark fantasy life phase";
}
