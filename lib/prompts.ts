import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a master narrative designer specialized in the official universe of League of Legends, also known as Runeterra.
You write cinematic, emotional, mysterious lore books that feel compatible with Riot Games' Runeterra world.
You create original characters who could plausibly exist in Runeterra.
You never contradict official League of Legends lore.
You never invent false facts about existing champions.
You output strict valid JSON only.`;

  const user = `Create a personalized illustrated lore book for this user, set inside the universe of League of Legends / Runeterra.

User information:
Name: ${input.name}
Gender: ${input.gender}
Archetype: ${input.archetype}
Tone: ${input.tone}
Universe style: ${input.universeStyle}
Runeterra Region: ${input.runeterraRegion}
Strength: ${input.strength}
Weakness: ${input.weakness}

The protagonist must be an original character in Runeterra.

Use official Runeterra regions when relevant:
Demacia, Noxus, Ionia, Piltover, Zaun, Shurima, Freljord, Bilgewater, Targon, Ixtal, Shadow Isles, Bandle City, the Void.

Use official lore elements only when appropriate:
magic, spirits, Ascended, Darkin, Vastaya, Hextech, Chemtech, Black Rose, Trifarix, Solari, Lunari, Sentinels of Light, the Void, ancient Shuriman ruins, Ionian spirits, Freljordian demigods, Noxian conquest, Demacian fear of magic, Zaunite experiments, Piltover progress.

Canon rules:
- Do not contradict official League of Legends lore.
- Do not invent fake events involving existing champions.
- Existing champions may be mentioned only lightly and only if it makes sense.
- Do not make the user defeat, replace, marry, kill, or become an existing champion.
- Do not make the user secretly related to an existing champion.
- The user must remain an original character.
- Original places, relics, enemies, prophecies, villages and minor characters are allowed if they do not contradict canon.
- Do not mention Riot Games, canon, sources, AI, prompts, or generation in the story.

Choose one main Runeterra region for the character.
If Runeterra Region is "Auto", choose the best region based on archetype, tone, strength and weakness.
If Runeterra Region is a specific region, the whole story must be anchored in that region.

Region selection logic:
- heroic / noble / guardian -> Demacia, Targon, Ionia, or Freljord
- dark / cursed / tragic -> Noxus, Shadow Isles, Zaun, Shurima, or the Void
- mysterious / spiritual -> Ionia, Targon, Ixtal, Bandle City, or Shadow Isles
- crime / thief / assassin -> Bilgewater, Zaun, Noxus, or Piltover
- monster / creature -> Void, Shadow Isles, Freljord, Ixtal, or Shurima
- mage / oracle -> Ionia, Targon, Ixtal, Shurima, or Demacia

The chosen region must influence:
- the visual identity
- the conflict
- the enemy or threat
- the tone of the story
- the character's destiny

The character must receive:
- a Runeterra region
- a legendary title
- a faction or social role, if relevant
- a personal conflict linked to that region
- a power or curse that feels believable inside Runeterra
- an enemy or threat that can be original but lore-compatible
- a final prophecy that leaves mystery

Return a JSON object matching this exact schema:
{
  "title": "string",
  "subtitle": "string",
  "mainRegion": "string",
  "narratorIntro": "string",
  "characterBible": {
    "name": "string",
    "legendaryTitle": "string",
    "region": "string",
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
- The writing must feel like a premium League of Legends lore biography adapted into an illustrated storybook.
- The story must be original but deeply anchored in Runeterra.
- Keep the tone cinematic, poetic, mysterious, emotional, and faithful to League of Legends lore.
- Do not use modern slang, parody, or comedy unless requested.
- Do not use generic fantasy terms when a Runeterra-specific element fits better.
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
- Page 3 visualDirection: intimate emotional scene; show weakness, loss, exile, shame, curse, or conflict through action/environment; use body language and symbolic objects.
- Page 4 visualDirection: supernatural discovery scene; sign, relic, omen, spirit, rune, vision, prophecy, strange light, or forbidden symbol; focus on event.
- Page 5 visualDirection: dynamic action scene; protagonist facing danger, escaping, climbing, fighting a non-canon creature, surviving a storm, or confronting a trial.
- Page 6 visualDirection: confrontation scene; original lore-compatible enemy/threat visible; protagonist and enemy both in frame when possible; no existing champions as enemies.
- Page 7 visualDirection: transformation scene; power awakening, armor changing, aura emerging, symbolic object activating, curse spreading, or destiny revealing itself.
- Page 8 visualDirection: cinematic final scene; mysterious open ending; protagonist moving toward or standing before a legendary place, portal, battlefield, temple, sea, mountain, ruins, celestial gate, or shadowed horizon.
- Explicit anti-repetition for every imagePrompt: no repeated portrait composition, no repeated background, no repeated camera angle, no generic character standing pose, no simple bust shot unless page specifically requires intimacy, no text, no logo, no watermark.`;

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
