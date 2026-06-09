import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a master narrative designer specialized in League of Legends lore and the world of Runeterra.
You create original characters who could plausibly exist in Runeterra.
You write illustrated lore books with cinematic narration, emotional depth, and strong regional identity.
You must avoid generic fantasy filler.
You must avoid repeating the same tropes from one generation to another.
You output strict valid JSON only.`;

  const user = `Create a personalized illustrated lore book set in Runeterra.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Runeterra Region: ${input.runeterraRegion}

You are not writing a generic dark fantasy story.
You are writing a specific life inside Runeterra.

Every story must feel:
- original
- region-specific
- narratively concrete
- emotionally memorable
- compatible with Runeterra
- different from a previous generation

Avoid overused clichés unless absolutely necessary:
- chosen one
- black star
- dark omen
- cursed bloodline
- forgotten throne
- ancient prophecy
- shadow king
- child of destiny
- born under a dead moon
- mysterious mark since birth
- generic exile
- generic dark power
- generic final boss transformation

Official Runeterra regions:
Demacia, Noxus, Ionia, Piltover, Zaun, Shurima, Freljord, Bilgewater, Targon, Ixtal, Shadow Isles, Bandle City, The Void.

If the region is "Auto", choose the most interesting Runeterra region for the character type.
If the user selected a specific region, the entire story must be anchored in that region.

Canon rules:
- The protagonist is an original character.
- The story must not contradict official League of Legends lore.
- Existing champions may be mentioned only lightly and only if it makes sense.
- Do not make the protagonist defeat, replace, marry, kill, or become an existing champion.
- Do not invent fake canon events involving existing champions.
- Do not claim the protagonist is secretly related to an existing champion.
- Do not mention Riot Games, AI, prompts, models, or technical terms.

Originality rules:
- Create a unique social role for the protagonist.
- Create a specific regional problem.
- Create a concrete motivation.
- Create a distinctive object, duty, craft, secret, relationship, or burden.
- Create a unique story engine.
- Avoid generic dark fantasy abstractions.
- Use grounded details from the region.
- The story must not feel like "a cursed hero with a prophecy" unless the character type strongly fits it.
- Every page must advance the story.

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
      "chapter": "The Name",
      "title": "string",
      "text": "string, 45 to 75 words",
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
  2. Childhood / origin: where they grew up, what shaped them, and the first visible traits of their character type.
  3. Wound / personal cost: the defining emotional cost, loss, mistake, obligation, or burden that follows them.
  4. First sign: the first supernatural sign that destiny is watching them.
  5. Awakening / powers: the trial where they obtain or awaken their powers, relic, weapon, or forbidden gift.
  6. Enemy / conflict: the force opposing them, external and internal, tied to their regional problem.
  7. Evolution / transformation: how they master the power and become a changed legendary figure.
  8. Final prophecy: an open-ended mysterious destiny that suggests the next chapter without resolving everything.
- Each page must clearly advance the protagonist's life and transformation. Do not write disconnected poetic fragments.
- Each page text must mention a concrete event, choice, or change in the protagonist's journey.
- Each page text must be 45 to 75 words.
- Each page must contain concrete regional details.
- Each page must avoid vague filler.
- The story must have a beginning, progression, conflict, transformation, and mysterious ending.
- The user must be the protagonist.
- The writing must feel like an original Runeterra biography transformed into an illustrated book.
- Create a unique personal arc every time.
- Do not always create a tragic lone hero, warrior, chosen one, or final-boss figure.
- Do not mention AI, prompt, generated, OpenAI, image model, or any technical term.
- The imagePrompt for each page must describe a full-page illustration.
- The imagePrompt must visually represent that page's exact life phase and event: birth, childhood, wound, omen, power awakening, enemy, transformation, or prophecy.
- Every imagePrompt must include the same characterBible details to keep visual consistency.
- Every imagePrompt must include: cinematic League of Legends-inspired fantasy illustration, Runeterra atmosphere, premium storybook art, dramatic lighting, coherent character design, no text, no logos, no watermark.
- The imagePrompt must avoid asking for written text inside the image.

IMAGE STORYTELLING RULES:
- The 8 images must work together as a sequential visual narrative.
- Each page must show a different moment of the story.
- Each page must have a different environment or visual focus.
- Each page must use a different camera shot.
- Avoid repeating close-up portraits.
- Use cover shot, wide shot, intimate scene, discovery scene, action scene, confrontation scene, transformation scene, and final cinematic scene.
- The protagonist must remain visually consistent, but the scene must change dramatically from page to page.
- Illustrations should show events, not only character poses.
- Every image prompt must clearly describe what is happening in the scene.
- Every image prompt must mention the chosen Runeterra region and include region-specific environmental details.
- The visual progression must match the chapter order.
- Only one or two pages maximum may be portrait-like.
- Most pages should show the character interacting with the world.
- Add a unique visualDirection object for every page.
- Page 1 visualDirection: iconic cover image; full-body or three-quarter figure; strong silhouette; symbolic background linked to the chosen Runeterra region; no simple face portrait.
- Page 2 visualDirection: wide establishing shot; birthplace or origin environment; character small or medium; architecture, landscape, culture, or region-specific details.
- Page 3 visualDirection: intimate emotional scene; show personal cost, loss, obligation, shame, or conflict through action/environment; use body language and symbolic objects.
- Page 4 visualDirection: supernatural discovery scene; sign, relic, omen, spirit, rune, vision, prophecy, strange light, or forbidden symbol; focus on event.
- Page 5 visualDirection: dynamic action scene; protagonist facing danger, escaping, climbing, fighting a non-canon creature, surviving a storm, or confronting a trial.
- Page 6 visualDirection: confrontation scene; original lore-compatible enemy/threat visible; protagonist and enemy both in frame when possible; no existing champions as enemies.
- Page 7 visualDirection: transformation scene; power awakening, armor changing, aura emerging, symbolic object activating, curse spreading, or destiny revealing itself.
- Page 8 visualDirection: cinematic final scene; mysterious open ending; protagonist moving toward or standing before a legendary place, portal, battlefield, temple, sea, mountain, ruins, celestial gate, or shadowed horizon.
- Explicit anti-repetition for every imagePrompt: no repeated portrait composition, no repeated background, no repeated camera angle, no generic character standing pose, no simple bust shot unless page specifically requires intimacy, no text, no logo, no watermark.

Before returning the final JSON, internally check:
- Is the story too generic?
- Is the protagonist's role specific?
- Does the region truly shape the plot?
- Is the conflict concrete?
- Does the story avoid cliché motifs?
- Would this feel different from ten other generations?

If the answer is not strong enough, rewrite the story before returning JSON.

Return strict JSON only.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const direction = page.visualDirection;
  const summary = summarizeForImage(page.text);

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

Character consistency:
The protagonist must remain consistent across the book: ${bible.visualIdentity}, ${bible.faceAndBody}, wearing ${bible.clothing}, aura: ${bible.aura}, symbolic object: ${bible.symbolicObject}, color palette: ${bible.colorPalette}.

Runeterra anchor:
The scene is set in ${bible.region}. Use lore-compatible Runeterra atmosphere and regional visual details: ${bible.runeterraLoreAnchor}.

Composition rules:
This image must be a story scene, not a generic portrait.
Show action, environment, and narrative progression.
Do not repeat a previous page composition.
Avoid close-up face portraits unless emotionally necessary.
Use a distinct camera angle and setting for this page.
No written text inside the image.
No logo.
No watermark.

Art style:
Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, painterly realism, dramatic lighting, atmospheric depth, elegant composition, high detail.`;
}

function summarizeForImage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
}
