import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export const IMAGE_STYLE_LOCK =
  "Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, high-end digital painting, refined character design, rich environment detail, dramatic but elegant lighting, atmospheric depth, painterly realism, sharp focal point, beautiful composition, high production value, no text, no logo, no watermark.";

export const IMAGE_STYLE_AVOIDANCES =
  "Avoid cheap AI fantasy look, blurry faces, generic armor, overused black-purple glowing villain style, flat backgrounds, repetitive portraits, plastic-looking characters, oversaturated neon colors, vague magical fog, random symbols without context, and disconnected fantasy poster poses.";

const BIOGRAPHY_PAGE_GUIDANCE = [
  "Beat 1: introduce the protagonist clearly — name, region, social role, and starting situation.",
  "Beat 2: show early life, daily reality, community, family, work, or duty.",
  "Beat 3: show the first major event that changes their path, caused by beat 2.",
  "Beat 4: introduce a meaningful canon-safe connection to one existing League champion from the region.",
  "Beat 5: end with a strong cliffhanger caused by beats 1–4; final sentence must create suspense.",
  "Beat 6: show the immediate consequence of the cliffhanger.",
  "Beat 7: show how the protagonist changes because of what happened.",
  "Beat 8: show where the protagonist stands now, with an open but understandable ending.",
];

const ROLE_VARIETY_HINT = `Invent a highly specific Runeterra role for the protagonist. The user's character type should influence the story, but the actual job or social position must be concrete and varied.
Avoid always generating: warrior, cursed fighter, exile, chosen one, orphan survivor, hidden mage, shadow-touched character, prophecy-driven character, final-boss style protagonist, generic rebel, generic monster hunter.
Examples of specific roles by region include: Demacia — petricite mason, border courier, bell tower keeper; Noxus — battlefield cartographer, arena bookkeeper, war medic; Ionia — shrine keeper, river guide, herbalist; Piltover — hextech lens polisher, bridge inspector, museum restorer; Zaun — chemtech salvage diver, sump courier, pipe repairer; Shurima — dune guide, oasis keeper, tomb lamp carrier; Freljord — ice fisher, tribal negotiator, storm reader; Bilgewater — harbor tax runner, dockside message runner, ship bell keeper; Targon — mountain guide, pilgrim escort, dawn bell ringer; Ixtal — living stone artisan, jungle border scout; Shadow Isles — lantern polisher, mist scout, ruined chapel caretaker; Bandle City — impossible mail carrier, portal mapmaker; The Void — frontier scout, biological anomaly cataloguer.`;

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a narrative designer specialized in League of Legends lore and Runeterra.
You create original characters who could plausibly exist in Runeterra.
You write immersive in-world chronicles adapted into illustrated storybooks.
Your writing is cinematic, grounded, atmospheric, and always easy to understand.
Every beat must follow logically from the previous one through events, not meta commentary.
You avoid abstract fantasy filler, vague prophecy poetry, and disconnected fragments.
You never break immersion by mentioning book structure, page numbers, readers, or generation mechanics in visible story text.
You output strict valid JSON only.`;

  const user = `Create an 8-page personalized illustrated lore book set in Runeterra.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Runeterra region: ${input.runeterraRegion}

If the region is Auto, choose the most coherent region for the character type.
If a specific region is selected, anchor the whole biography in that region.

Main requirement:
Write a clear chronological in-world life story of the protagonist.

The audience must easily understand:
- who the protagonist is
- where they come from
- what their role is
- what changed their life
- how an existing League champion connects to their life in beat 4
- why beat 5 ends with suspense
- what happens after the suspense
- where the character stands at the end

IMMERSION RULE (hard):
The visible story text in title, chapter, narratorIntro, and every pages[].text must never reference:
page numbers, page structure, biography structure, previous page, next page, chapter mechanics, paywall, unlock, paid section, reader, user, generated story, prompt, AI, JSON, "this biography", "this page", "the narrative", continuation, or story structure.
Write as in-world Runeterra lore. Transitions must happen through events, memories, objects, places, dialogue, consequences, and decisions.
Never say: "page", "chapter", "biography", "previous", "next", "reader", "user", "unlock", "paid", "continuation", "narrative", "story structure", or "generated".
continuityNote is internal metadata only and must never be copied into pages[].text.

Tone:
- immersive Runeterra character chronicle
- mythic but understandable lore entry
- a real life recounted from inside the world
- cinematic, grounded, atmospheric
Do NOT sound like an analysis of a biography, a summary of page events, or a technical outline.

${ROLE_VARIETY_HINT}
Store the chosen specific role in originalityProfile.specificRole and characterBible.socialRole.

Hidden chronological structure (do not use these labels as page titles, chapter names, or visible text):
${BIOGRAPHY_PAGE_GUIDANCE.map((line) => `- ${line}`).join("\n")}

Important:
- Return exactly 8 pages.
- Each page chapter and title must be unique, story-specific, and in-world.
- Do not use fixed structure labels like "The Trial", "The Sign", "Origin", or "The Final Prophecy" as chapter names.
- Each page text must be 55 to 90 words.
- Each page after page 1 must clearly continue from the previous page through natural storytelling.
- The first sentence of pages 2–8 should naturally follow the previous page.
- Use cause and effect through repeated objects, locations, wounds, letters, rumors, relationships, faction pressure, and consequences.
- Do not use: "as seen earlier", "from page 3", "the earlier section", "the next part", or "his biography".
- Beat 4 must include the champion connection naturally in the scene. Name the champion or show unmistakable influence.
- Beat 5 must end with a clear in-world cliffhanger sentence only.
- The story must be simple enough to follow but still beautiful.
- Avoid vague symbolism that is not explained.
- Avoid generic dark fantasy clichés.
- Avoid making every story about prophecy, curses, shadows, or chosen ones.

Writing style:
- clear chronological life story
- simple narrative progression
- concrete events, places, jobs, objects, decisions, and consequences
- less abstract poetry and fewer unexplained metaphors
- no disconnected fragments

Reduce overuse of vague words such as:
destiny, shadow, omen, forgotten stars, ancient whispers, nameless darkness, fate, prophecy, silence remembered him, the world forgot his name.

Champion connection rules (beat 4):
- Choose one existing League of Legends champion based on the region.
- Write the scene naturally inside the world. Never say "page 4 introduces".
- The connection must be meaningful but canon-safe.
- The protagonist must remain original and central.
- Do not make the protagonist defeat, kill, replace, marry, or secretly belong to the champion's family.
- Do not invent major fake canon events involving champions.
- The champion should influence the protagonist indirectly or briefly.

Beat 5 cliffhanger rules:
- Must come directly from the champion connection and previous events.
- Must be purely in-world.
- Must not mention free page, paid section, next page, unlock, continuation, or reader.
- The final sentence of beat 5 must be a clear cliffhanger.

Canon rules:
- Do not contradict official League of Legends lore.
- Do not mention Riot Games, AI, prompts, models, paywall, paid section, or technical terms in visible story text.

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
    "championConnectionPage4": "string",
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
      "text": "string, 55 to 90 words",
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
- Page 4 image: suggest the champion connection indirectly when safer — faction symbols, aftermath, rumors, letters, places, objects, crowds, banners, or distant silhouettes. Do not force the champion to appear directly unless canon-safe and distant.
- Page 5 image: must clearly show the cliffhanger moment.
- Every imagePrompt must include the same characterBible details for visual consistency.
- Every imagePrompt must include: ${IMAGE_STYLE_LOCK}
- ${IMAGE_STYLE_AVOIDANCES}
- No written text inside the image.

Visual direction guidance by page:
- Page 1: clear introduction scene in the region; show role and starting situation.
- Page 2: wide establishing shot of daily life, community, work, or duty.
- Page 3: the first major changing event in a concrete location.
- Page 4: champion connection scene with indirect visual references when safer.
- Page 5: cliffhanger moment with strong narrative focus.
- Page 6: immediate consequence scene.
- Page 7: change/transformation through action and environment.
- Page 8: current fate scene with open but understandable ending.

Before returning JSON, internally verify:
- Is the story easy to follow beat by beat?
- Does beat 4 naturally include the champion connection in-world?
- Does beat 5 end with an in-world cliffhanger?
- Are pages connected with cause and effect without meta references?
- Is the protagonist role specific and varied?
- Does the job or social role affect the events?
- Does any visible text mention page, chapter, biography, reader, unlock, paid, continuation, narrative, prompt, or generated? If yes, rewrite it.
- Is the writing concrete rather than abstract?

Return strict JSON only.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const direction = page.visualDirection;
  const summary = summarizeForImage(page.text);
  const championHint =
    page.pageNumber === 4 && book.championConnection?.championName
      ? `Champion connection (indirect visual reference only unless distant/safe): ${book.championConnection.championName}. ${book.championConnection.connectionSummary}`
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
