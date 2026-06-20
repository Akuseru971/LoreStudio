import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";
import { PAGE_TITLE_PROMPT_RULES, PAGE_TITLE_SELF_CHECK } from "@/lib/page-titles";
import {
  ANTI_REPETITION_VALIDATION,
  CHAMPION_CONNECTION_TYPES,
  IMAGE_PROMPT_RULES,
  pickStoryArchetype,
  STORY_ARCHETYPES,
} from "@/lib/story-engine";

export const IMAGE_STYLE_LOCK =
  "Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, high-end digital painting, refined character design, rich environment detail, dramatic but elegant lighting, atmospheric depth, painterly realism, sharp focal point, beautiful composition, high production value, no text, no logo, no watermark.";

export const IMAGE_STYLE_AVOIDANCES =
  "Avoid cheap AI fantasy look, blurry faces, generic armor, overused black-purple glowing villain style, flat backgrounds, repetitive portraits, plastic-looking characters, oversaturated neon colors, vague magical fog, random symbols without context, disconnected fantasy poster poses, glowing relics, sealed doors, mysterious maps, and hooded figures in mist.";

export function buildLorePrompt(input: BookFormInput) {
  const suggestedArchetype = pickStoryArchetype(
    `${input.name}:${input.gender}:${input.characterType}:${input.runeterraRegion}:${Date.now()}`,
  );

  const system = `You are a narrative designer writing original Runeterra-style champion biographies.
Your task is to create fresh, surprising, emotionally coherent biographies.
You must avoid formulaic fantasy patterns.
You must not write quests, relic hunts, prophecy stories, or clue-based mysteries unless transformed in a truly original way.
You write serious, elegant, in-world biographies about people whose lives became legendary for unusual reasons.
You output strict valid JSON only.`;

  const user = `Create an 8-page illustrated biography for an original character in Runeterra.

User input:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Region: ${input.runeterraRegion}

Main goal:
Create a biography that feels fresh, unusual, and specific.
Break predictable story patterns.
Do not follow the same page formula as previous generations.

Before writing, secretly choose a unique story engine and build the entire biography from it:
- archetype
- central irony
- public reputation
- private truth
- social pressure
- irreversible event
- champion connection type
- final contradiction

Suggested archetype for this generation (invent a stronger one if needed):
${suggestedArchetype}

You may also draw from archetypes such as:
${STORY_ARCHETYPES.slice(0, 10).join("\n")}
and other original archetypes not listed here.

The story must feel like a real life, not a fantasy quest.

The protagonist may be:
- admired for the wrong reason
- hated for a necessary act
- erased from the history they changed
- used as propaganda
- trapped by a lie
- shaped by a profession becoming dangerous
- changed by politics, shame, family, war, faith, law, or reputation
- important on a local scale rather than world scale

Social scale may be small and powerful:
a family, village, guild, temple, harbor, regiment, court, prison, school, caravan, tribe, mining crew, theater, hospital, archive, market, cult, local myth, or border dispute.

Outcomes may vary:
feared but powerless, influential without magic, famous for the wrong reason, morally compromised, politically useful, spiritually broken, quietly dangerous, remembered incorrectly, alive but erased, loved by enemies, hated by the people they saved, used as propaganda, trapped by reputation, willingly forgotten.

Hard bans:
Do not use hidden objects, ancient relics, secret debts, old promises, mysterious maps, sealed doors, letters from champions, champion seals, prophecy, chosen-one logic, cursed bloodlines, magical marks, whispering artifacts, shadow voices, secret factions watching, or "the device spoke their name."

Champion connection:
The champion connection must appear on page 5.
It must not be a clue left by the champion.
It must be structural, social, political, religious, cultural, historical, or reputational.
The champion's existence or actions must affect the protagonist's life, but the protagonist remains the center.

Better champion connection types include:
${CHAMPION_CONNECTION_TYPES.join("\n")}

Page 5:
Page 5 must end with a strong reason to continue.
The cliffhanger must not rely on an object reveal.
Use moral, social, political, emotional, or psychological tension.

Examples of better cliffhangers:
- publicly honored for the thing they are most ashamed of
- a law makes their ordinary job a crime
- their enemy tells the truth and no one believes it
- their family survives only if they accept a false identity
- their name is added to a list of heroes, traitors, saints, or monsters
- a champion's ideology is used to justify destroying their life

Style:
- serious, elegant, immersive, easy to follow
- inspired by official League champion biographies
- concrete and specific
- no meta language
- no page references inside text
- no generic chapter titles
- no repeated sentence patterns

Length:
- exactly 8 pages
- 55 to 95 words per page
- same approximate size as the current UI
- each page must feel connected as one biography

${PAGE_TITLE_PROMPT_RULES}

${IMAGE_PROMPT_RULES}
- Every imagePrompt must include: ${IMAGE_STYLE_LOCK}
- ${IMAGE_STYLE_AVOIDANCES}

${ANTI_REPETITION_VALIDATION}

${PAGE_TITLE_SELF_CHECK}

Return strict JSON matching this schema:
{
  "title": "character name",
  "subtitle": "legendary epithet",
  "region": "selected or chosen region",
  "genre": "in-world biography",
  "storyEngine": {
    "archetype": "string",
    "centralIrony": "string",
    "publicReputation": "string",
    "privateTruth": "string",
    "socialPressure": "string",
    "irreversibleEvent": "string",
    "championConnectionType": "string",
    "finalContradiction": "string"
  },
  "championConnection": {
    "championName": "string",
    "connectionType": "string",
    "connectionSummary": "string",
    "whyItMatters": "string",
    "canonSafetyNote": "string"
  },
  "visualBible": {
    "appearance": "string",
    "clothing": "string",
    "regionAtmosphere": "string",
    "colorPalette": "string",
    "recurringVisualMotif": "string"
  },
  "pages": [
    {
      "pageNumber": 1,
      "title": "specific biography title",
      "text": "55-95 words",
      "imagePrompt": "specific scene prompt"
    }
  ]
}

Return strict JSON only.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const visual = book.visualBible;
  const summary = summarizeForImage(page.text);
  const championHint =
    page.pageNumber === 5
      ? `Champion connection (structural/social, not a relic clue): ${book.championConnection.championName}. ${book.championConnection.connectionSummary}. Why it matters: ${book.championConnection.whyItMatters}`
      : "";
  const engineHint = `Story engine: ${book.storyEngine.archetype}. Central irony: ${book.storyEngine.centralIrony}.`;

  const modelPrompt = page.imagePrompt?.trim();
  if (modelPrompt && modelPrompt.length >= 180) {
    return `${modelPrompt}

Narrative moment:
${summary}
${engineHint}
${championHint ? `\n${championHint}\n` : ""}
Character consistency:
${visual.appearance}. Clothing: ${visual.clothing}. Palette: ${visual.colorPalette}. Recurring motif: ${visual.recurringVisualMotif}.
Region atmosphere: ${visual.regionAtmosphere}.

Art style:
${IMAGE_STYLE_LOCK}
${IMAGE_STYLE_AVOIDANCES}
No written text inside the image.`;
  }

  return `Create a full-page illustrated biography scene for Page ${page.pageNumber}: ${page.title}.

Narrative moment:
${summary}

${engineHint}
${championHint ? `\n${championHint}\n` : ""}
Show a concrete social scene with profession, public event, or regional setting.
Avoid generic mist portraits, glowing relics, sealed doors, and mysterious maps.

Character consistency:
${visual.appearance}. Clothing: ${visual.clothing}. Palette: ${visual.colorPalette}. Motif: ${visual.recurringVisualMotif}.
Region atmosphere: ${visual.regionAtmosphere}.

Art style:
${IMAGE_STYLE_LOCK}
${IMAGE_STYLE_AVOIDANCES}
No written text inside the image.`;
}

function summarizeForImage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
}
