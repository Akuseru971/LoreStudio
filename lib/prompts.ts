import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export const IMAGE_STYLE_LOCK =
  "Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, high-end digital painting, refined character design, rich environment detail, dramatic but elegant lighting, atmospheric depth, painterly realism, sharp focal point, beautiful composition, high production value, no text, no logo, no watermark.";

export const IMAGE_STYLE_AVOIDANCES =
  "Avoid cheap AI fantasy look, blurry faces, generic armor, overused black-purple glowing villain style, flat backgrounds, repetitive portraits, plastic-looking characters, oversaturated neon colors, vague magical fog, random symbols without context, and disconnected fantasy poster poses.";

const ROLE_VARIETY_HINT = `Invent a highly specific Runeterra role for the protagonist. The user's character type should influence the story, but the actual job or social position must be concrete and varied.
Avoid always generating: warrior, cursed fighter, exile, chosen one, orphan survivor, hidden mage, shadow-touched character, prophecy-driven character, final-boss style protagonist, generic rebel, generic monster hunter.
Use very varied roles such as: courier, shrine keeper, relic cleaner, chemtech repairer, harbor worker, cartographer, medic, archivist, bridge inspector, caravan guard, fisher, temple scribe, failed inventor, debt collector, lantern keeper, storm reader, mapmaker, artisan, translator, scout, musician, cook, blacksmith, messenger, guide, witness, smuggler, healer, factory worker, clerk, orphanage assistant, prisoner recorder, ship bell keeper.
The role must shape the events. Do not assign a job and ignore it.`;

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a narrative designer specialized in League of Legends lore and Runeterra.
You create original characters who could plausibly exist in Runeterra.
You write immersive, easy-to-follow character biographies adapted into illustrated storybooks.
Your stories must feel like one continuous life story, not a rigid page template.
You avoid abstract filler, repeated formulas, and meta references.
You output strict valid JSON only.`;

  const user = `Create an 8-page personalized illustrated lore book set in Runeterra.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Runeterra region: ${input.runeterraRegion}

If the region is Auto, choose the most coherent region for the character type.
If a region is selected, anchor the whole biography in that region.

Main requirement:
Write one clear, chronological biography of the protagonist, then divide it naturally into 8 illustrated pages.

The protagonist must feel like a real inhabitant of Runeterra with:
- a specific role
- a concrete place in the region
- a believable motivation
- a life shaped by events
- a clear progression from beginning to current fate

Biography-first generation (internal only — never expose these steps in visible text):
1. Create a complete life arc for the protagonist.
2. Make sure the arc is simple, chronological, and easy to follow.
3. Divide that arc into 8 natural story pages.
4. Avoid repeating the same sentence patterns from one page to another.

Hidden flexible flow (generation guideline only — do not use as visible titles or formulas):
- Pages 1–4: build a clear, natural biography. Show origin, role, personality, region, and growing tension. The order can vary — do not force page 2 to be routine, page 3 to be a first event, or the same transitions every time.
- Page 5: reveal a meaningful connection to one existing League of Legends champion, then end with a strong in-world cliffhanger.
- Pages 6–8: continue directly from the cliffhanger — consequence, change, and current fate.

Story rules:
- The story must be easy to follow from beginning to end.
- The story must not feel like a page-by-page checklist.
- Do not force page 2 to describe daily routine.
- Do not force page 3 to be a first event.
- Do not force repeated structures or sentence openings.
- Each page must feel like a natural continuation of the previous one.
- Each page chapter and title must be unique and story-specific.
- Each page text must be 55 to 95 words.
- The visible text must read like one continuous biography cut into illustrated pages.

Immersion rules (hard):
- Never mention page numbers inside the story text.
- Never mention biography mechanics, story arc, chapter mechanics, reader, user, prompt, AI, unlock, payment, next page, previous page, or paid section.
- The text must read like in-world Runeterra lore.
- continuityNote is internal metadata only and must never appear in pages[].text.

Tone:
- polished League of Legends biography adapted into an illustrated book
- immersive, clear, chronological, cinematic but not confusing
- concrete enough to follow
- not too abstract, not too academic, not too mechanical

Avoid:
- vague symbols that are never explained
- repeated phrases and repeated sentence openings across pages
- overusing fate, shadow, whisper, forgotten, legend, prophecy
- meta language about the story

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
      "chapter": "string, unique story-specific chapter label",
      "title": "string, unique story-specific page title",
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
- Are the first sentences of pages too similar?
- Do multiple pages start with the same structure?
- Does the story repeat the same phrase?
- Does it overuse fate, shadow, whisper, forgotten, legend, or prophecy?
- Does the biography feel like one continuous story?
- Is page 5 clearly connected to a champion?
- Does page 5 end with a real in-world cliffhanger?
- Does any visible text mention page, chapter, biography, reader, unlock, paid, continuation, narrative, prompt, or generated? If yes, rewrite it.
- Is the protagonist role specific and varied?
- Does the job or social role affect the events?

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
