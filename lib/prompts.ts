import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";
import { PAGE_TITLE_PROMPT_RULES, PAGE_TITLE_SELF_CHECK } from "@/lib/page-titles";

export const IMAGE_STYLE_LOCK =
  "Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, high-end digital painting, refined character design, rich environment detail, dramatic but elegant lighting, atmospheric depth, painterly realism, sharp focal point, beautiful composition, high production value, no text, no logo, no watermark.";

export const IMAGE_STYLE_AVOIDANCES =
  "Avoid cheap AI fantasy look, blurry faces, generic armor, overused black-purple glowing villain style, flat backgrounds, repetitive portraits, plastic-looking characters, oversaturated neon colors, vague magical fog, random symbols without context, and disconnected fantasy poster poses.";

const ROLE_VARIETY_HINT = `Invent a highly specific Runeterra role for the protagonist. The user's character type should influence the story, but the actual job or social position must be concrete and varied.
Avoid always generating: warrior, cursed fighter, exile, chosen one, orphan survivor, hidden mage, shadow-touched character, prophecy-driven character, final-boss style protagonist, generic rebel, generic monster hunter.
Use very varied roles such as: courier, shrine keeper, relic cleaner, chemtech repairer, harbor worker, cartographer, medic, archivist, bridge inspector, caravan guard, fisher, temple scribe, failed inventor, debt collector, lantern keeper, storm reader, mapmaker, artisan, translator, scout, musician, cook, blacksmith, messenger, guide, witness, smuggler, healer, factory worker, clerk, orphanage assistant, prisoner recorder, ship bell keeper.
The role must shape the events. Do not assign a job and ignore it.`;

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a narrative designer writing champion-style biographies set in Runeterra.
Your style is inspired by official League of Legends champion biographies: clear, dramatic, chronological, emotionally driven, and grounded in a specific region.
You write original characters who could plausibly exist in Runeterra.
You avoid disconnected poetic fragments, vague prophecies, and random fantasy symbolism.
You output strict valid JSON only.`;

  const user = `Create an 8-page illustrated biography for an original Runeterra character.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Region: ${input.runeterraRegion}

Write the story like a concise official champion biography adapted into 8 illustrated pages.

If the region is Auto, choose the most coherent region for the character type.
If a region is selected, anchor the whole biography in that region.

Title:
Use the character name as the book title.

Subtitle:
Use a legendary title or epithet.

Hidden structure (internal only — never mention page numbers, structure, chapters, or biography mechanics in visible text):
- Pages 1–4: build a proper biography with origin, social position, flaws or desire, place in the region, relationships or obligations, first shaping events, and growing tension.
- Page 5: reveal a meaningful connection to one existing League of Legends champion. This is the major turning point and cliffhanger.
- Pages 6–8: continue the consequence of the champion connection — what it changes, what the character becomes, what they now represent, and a strong final ending.

The biography must:
- open with a strong introduction
- clearly explain who the character is
- explain where they come from
- show what they wanted, feared, or lacked
- show the events that changed their life
- include emotional motivation
- include concrete regional details
- build toward a major turning point
- reveal a meaningful connection to one existing League of Legends champion on page 5
- end page 5 with a strong cliffhanger
- continue pages 6–8 with clear consequences
- end with a memorable final state

Style reference:
Use the structure and tone of official champion biographies like Viego's biography:
a clear life story, dramatic escalation, emotional obsession or motivation, tragedy or transformation, and strong final lines.

Do not copy Viego.
Do not reuse Viego's story.
Do not mention Viego unless it is canonically relevant to the selected region and champion connection.

Length:
- exactly 8 pages
- 55 to 95 words per page
- keep text size similar to the current UI
- do not generate a huge biography

Writing style:
- serious, mythic, elegant, clear, dramatic, grounded in Runeterra, emotionally driven, easy to follow
- read like one continuous official lore text cut into 8 pages
- every event must have a cause and consequence
- the protagonist's motivation must be clear

Do NOT feel like:
- random fantasy fragments
- AI-generated purple prose
- "a prophecy chose him"
- weird abstract symbolism
- disconnected page scenes
- a checklist
- a technical character summary
- an RPG quest log

Immersion (hard):
- never mention page numbers inside the story text
- never mention "this biography"
- never mention "reader"
- never mention "story structure"
- never mention "next page"
- never mention "unlock"
- never mention payment
- never mention AI or prompt
- continuityNote is internal metadata only and must never appear in pages[].text

Avoid:
- vague symbols that are never explained
- repeated phrases and repeated sentence openings across pages
- overusing fate, shadow, whisper, forgotten, legend, prophecy
- meta language about the story
- stereotyped chapter filler in pages[].text such as "the trial began", "the pattern broke", "fate shifted", "the omen arrived", "destiny called"

${PAGE_TITLE_PROMPT_RULES}

${ROLE_VARIETY_HINT}
Store the chosen specific role in originalityProfile.specificRole and characterBible.socialRole.

Champion connection (page 5 only):
- The champion connection must appear on page 5, not earlier.
- Choose a champion that fits the region.
- Page 5 must explicitly include the champion name or a very clear champion-linked element.
- The connection must be clear, meaningful, and canon-safe.
- The protagonist remains an original character and stays central.
- Do not make the protagonist defeat, kill, replace, marry, or secretly belong to the champion's family.
- Do not invent major false canon events.
- The champion should influence the protagonist's life without taking the story away from them.
- Page 5 must end with a strong in-world cliffhanger that makes the reader want to know what happens next.
- The cliffhanger must not mention payment, unlock, continuation, reader, or next page.

Pages 6–8:
- Continue directly from the page 5 cliffhanger.
- Reveal what the champion connection means, what consequence follows, how the protagonist changes, and where they stand now.
- The ending can stay mysterious but must be understandable.
- No random abstract ending or sudden unexplained transformation.

Canon rules:
- Do not contradict official League of Legends lore.
- Do not mention Riot Games, AI, prompts, models, or technical terms in visible story text.

Return a JSON object matching this exact schema:
{
  "title": "string",
  "subtitle": "string",
  "mainRegion": "string",
  "storyEngine": "string",
  "protagonistRole": "string",
  "coreConflict": "string",
  "distinctiveHook": "string",
  "narratorIntro": "string",
  "biographyArc": {
    "startingSituation": "string",
    "incitingEvent": "string",
    "championConnectionPage5": "string",
    "page5Cliffhanger": "string",
    "finalState": "string"
  },
  "championConnection": {
    "championName": "string",
    "connectionType": "string",
    "connectionSummary": "string",
    "canonSafetyNote": "string"
  },
  "originalityProfile": {
    "specificRole": "string",
    "dailyReality": "string",
    "regionalPressure": "string",
    "unusualStoryElement": "string",
    "repetitionAvoided": ["string"]
  },
  "characterBible": {
    "name": "string",
    "gender": "string",
    "characterType": "string",
    "legendaryTitle": "string",
    "region": "string",
    "socialRole": "string",
    "visualIdentity": "string",
    "clothing": "string",
    "faceAndBody": "string",
    "aura": "string",
    "symbolicObject": "string",
    "colorPalette": "string",
    "worldRules": "string",
    "runeterraLoreAnchor": "string"
  },
  "pages": [
    {
      "pageNumber": 1,
      "chapter": "string, must exactly match title",
      "title": "string, unique premium biography section heading, 3 to 8 words",
      "text": "string, 55 to 95 words",
      "continuityNote": "string, internal only — how this page connects to the previous page",
      "visualDirection": {
        "sceneType": "string",
        "cameraShot": "string",
        "characterAction": "string",
        "environment": "string",
        "keyObjects": ["string"],
        "mood": "string",
        "lighting": "string"
      },
      "imagePrompt": "string"
    }
  ]
}

Image prompt rules:
- Each image must illustrate the concrete event of its page.
- Show where the character is, what they are doing, and what event is happening.
- Avoid random portraits, vague magical symbols, disconnected fantasy posters, and repeated foggy standing poses.
- Page 5 image: must show the champion connection and cliffhanger moment with strong narrative focus.
- Pages 6–8: show consequences, change, and current fate.
- Every imagePrompt must include the same characterBible details for visual consistency.
- Every imagePrompt must include: ${IMAGE_STYLE_LOCK}
- ${IMAGE_STYLE_AVOIDANCES}
- No written text inside the image.

Before returning JSON, internally verify:
- Does the biography make sense from beginning to end?
- Can a normal reader explain what happened?
- Does every event have a cause and consequence?
- Is the protagonist's motivation clear?
- Is the region concrete?
- Does the champion connection appear on page 5?
- Is the page 5 cliffhanger clear?
- Does the text avoid random abstract symbolism?
- Does it avoid repeated sentence patterns?
- Does it sound like a serious champion biography?
- Are the first sentences of pages too similar?
- Do multiple pages start with the same structure?
- Does the story repeat the same phrase?
- Does it overuse fate, shadow, whisper, forgotten, legend, or prophecy?
- Does any visible text mention page, chapter, biography, reader, unlock, paid, continuation, narrative, prompt, or generated? If yes, rewrite it.
- Is the protagonist role specific and varied?
- Does the job or social role affect the events?

${PAGE_TITLE_SELF_CHECK}

If any answer is no, rewrite before returning JSON.

Return strict JSON only.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const direction = page.visualDirection;
  const summary = summarizeForImage(page.text);
  const championHint =
    page.pageNumber === 5 && book.championConnection?.championName
      ? `Champion connection and cliffhanger (indirect visual reference when safer): ${book.championConnection.championName}. ${book.championConnection.connectionSummary}`
      : "";
  const cliffhangerHint =
    page.pageNumber === 5 && book.biographyArc?.page5Cliffhanger
      ? `Cliffhanger focus: ${book.biographyArc.page5Cliffhanger}`
      : "";

  return `Create a full-page illustrated storybook scene for Page ${page.pageNumber}: ${page.chapter} — ${page.title}.

Narrative moment:
${summary}

Scene type:
${direction.sceneType}

Camera shot:
${direction.cameraShot}

Character action:
${direction.characterAction}

Environment:
${direction.environment}

Key objects:
${direction.keyObjects.join(", ")}

Mood:
${direction.mood}

Lighting:
${direction.lighting}
${championHint ? `\n${championHint}\n` : ""}${cliffhangerHint ? `\n${cliffhangerHint}\n` : ""}
Character consistency:
The protagonist must remain consistent across the book: ${bible.visualIdentity}, ${bible.faceAndBody}, wearing ${bible.clothing}, aura: ${bible.aura}, symbolic object: ${bible.symbolicObject}, color palette: ${bible.colorPalette}.

Runeterra anchor:
The scene is set in ${bible.region}. Use lore-compatible Runeterra atmosphere and regional visual details: ${bible.runeterraLoreAnchor}.

Composition rules:
Illustrate the concrete event happening on this page.
Show action, place, and cause-and-effect storytelling.
Do not use a generic portrait or unexplained magical symbol.
Do not repeat a previous page composition.
Avoid close-up face portraits unless emotionally necessary.
Use a distinct camera angle and setting for this page.
No written text inside the image.
No logo.
No watermark.

Art style:
${IMAGE_STYLE_LOCK}

${IMAGE_STYLE_AVOIDANCES}
Every image must feel like a polished storybook illustration of a biography moment, not a random AI portrait.`;
}

function summarizeForImage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
}
