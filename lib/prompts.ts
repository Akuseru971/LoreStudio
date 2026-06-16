import type { BookFormInput, BookPage, LoreBook } from "@/lib/types";

export const IMAGE_STYLE_LOCK =
  "Cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art, high-end digital painting, refined character design, rich environment detail, dramatic but elegant lighting, atmospheric depth, painterly realism, sharp focal point, beautiful composition, high production value, no text, no logo, no watermark.";

export const IMAGE_STYLE_AVOIDANCES =
  "Avoid cheap AI fantasy look, blurry faces, generic armor, overused black-purple glowing villain style, flat backgrounds, repetitive portraits, plastic-looking characters, and oversaturated neon colors.";

const REGION_CHAMPION_POOL = `Demacia: Lux, Garen, Jarvan IV, Sylas, Fiora, Galio, Poppy, Vayne, Shyvana
Noxus: Darius, Draven, Swain, Katarina, Talon, Riven, Samira, LeBlanc, Sion
Ionia: Irelia, Yasuo, Yone, Ahri, Karma, Shen, Zed, Akali, Master Yi, Wukong, Sett, Syndra, Varus, Xayah, Rakan
Piltover: Caitlyn, Vi, Jayce, Ezreal, Camille, Seraphine, Heimerdinger, Orianna
Zaun: Jinx, Ekko, Viktor, Warwick, Singed, Twitch, Zac, Renata Glasc, Zeri, Dr. Mundo
Shurima: Azir, Nasus, Renekton, Sivir, Taliyah, Xerath, Amumu, Rammus, Naafiri, K'Sante
Freljord: Ashe, Sejuani, Lissandra, Braum, Tryndamere, Olaf, Anivia, Ornn, Volibear, Udyr, Nunu & Willump, Trundle
Bilgewater: Miss Fortune, Gangplank, Twisted Fate, Graves, Illaoi, Pyke, Nautilus, Tahm Kench, Fizz
Targon: Leona, Diana, Pantheon, Taric, Soraka, Zoe, Aurelion Sol, Aphelios
Ixtal: Qiyana, Milio, Neeko, Nidalee, Zyra, Rengar, Malphite
Shadow Isles: Viego, Thresh, Kalista, Hecarim, Karthus, Yorick, Gwen, Maokai, Vex, Elise
Bandle City: Teemo, Tristana, Lulu, Veigar, Corki, Rumble, Yuumi, Kennen, Poppy, Vex
The Void: Kai'Sa, Kassadin, Malzahar, Vel'Koz, Rek'Sai, Kha'Zix, Cho'Gath, Bel'Veth`;

export function buildLorePrompt(input: BookFormInput) {
  const system = `You are a master narrative designer specialized in League of Legends lore and Runeterra.
You create original characters who could plausibly exist in Runeterra.
You write personalized illustrated lore books with cinematic narration, regional identity, emotional depth, and chronological storytelling.
You must connect the protagonist lightly but meaningfully to one existing League of Legends champion in a canon-safe way.
You must avoid generic fantasy filler.
You must avoid repetitive page structures.
You output strict valid JSON only.`;

  const user = `Create a personalized illustrated lore book set in Runeterra.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Runeterra region: ${input.runeterraRegion}

If the region is "Auto", choose the most interesting Runeterra region and champion connection for this character type.
If a region is selected, anchor the story in that region.

The protagonist must be an original character in Runeterra.

Champion connection requirement:
- Choose one existing League of Legends champion connected to the protagonist's early story.
- Select a champion that fits the chosen region and character type.
- The connection must appear naturally between pages 1 and 3.
- The connection must be meaningful but light-touch.
- The champion must not dominate the story or solve the protagonist's arc.
- Do not rewrite or contradict champion canon.
- Do not make the protagonist defeat, kill, replace, marry, romance, or secretly belong to the champion's family.
- Do not make the protagonist stronger than a champion in a canon-breaking way.
- Do not invent major fake canon events involving champions.
- Valid connection types include: witnessed, inspired_by, indirectly_affected, rumor, shared_region, faction_shadow, object_link, survived_event.
- The connection should add lore attachment and emotional weight.

Region champion pools for selection:
${REGION_CHAMPION_POOL}

Story structure:
- Generate exactly 8 pages.
- The story must unfold chronologically.
- Do not use rigid labels like The Trial, The Enemy, The Transformation, The Final Prophecy, The Wound, or The Sign.
- Each page chapter and title must be unique, concrete, and specific to this story.
- Page 5 is the last free page before the paid continuation.
- Page 5 must end on a strong, specific cliffhanger that makes the reader urgently want page 6.
- Page 5 must not always be a fight or trial.
- Page 5 suspense must be earned by pages 1–4.
- Pages 6–8 resolve or deepen the cliffhanger and continue the character's fate.

Hidden page logic (do not use these labels as chapter names):
1. identity / place in Runeterra
2. early life / region / social role
3. champion connection or its first consequence
4. rising personal conflict
5. major suspense / cliffhanger / continuation trigger
6. consequence of the cliffhanger
7. transformation or decisive choice
8. current fate / open-ended ending

Canon rules:
- Do not contradict official League of Legends lore.
- Existing champions may be referenced only in canon-safe ways.
- Do not mention Riot Games, AI, prompts, models, paywall, paid section, unlocking, or technical terms in the story.

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
  "championConnection": {
    "championName": "string",
    "connectionType": "string",
    "connectionSummary": "string",
    "canonSafetyNote": "string"
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
      "chapter": "string",
      "title": "string",
      "text": "string",
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

Page rules:
- Return exactly 8 pages with pageNumber 1 through 8.
- Each page text must be 45 to 90 words.
- Each page must be concrete, chronological, emotionally engaging, and region-specific.
- Each page must advance the story with a concrete event, choice, or change.
- Pages 1–3 must establish character, region, stakes, and the champion connection.
- Page 5 must end with a suspenseful final sentence that teases page 6.
- Page 5 cliffhanger examples (do not reuse verbatim): a sealed door opening from the other side; a name written in ash that no one should know; a dead messenger whose letter begins to speak; footsteps behind the protagonist that are not human; a relic pointing at the protagonist instead of north.
- Pages 6–8 must respond to the cliffhanger without mentioning payment or unlocking.
- The user must remain the protagonist.

Image prompt rules:
- Each imagePrompt must describe a full-page illustration for that exact story moment.
- Every imagePrompt must include the same characterBible details for visual consistency.
- Every imagePrompt must include: ${IMAGE_STYLE_LOCK}
- ${IMAGE_STYLE_AVOIDANCES}
- The imagePrompt must avoid asking for written text inside the image.
- Pages 1–3 may show champion influence indirectly through banner, rumor poster, aftermath, object, place, light, weapon mark, faction symbol, crowd reaction, or distant silhouette — not a direct champion portrait unless a distant silhouette is necessary.
- Page 5 image must visually support the cliffhanger and create urgency to know what happens next.
- The protagonist remains the visual focus; do not make every image about the champion.

Visual direction rules:
- Add a unique visualDirection object for every page.
- Page 1: iconic cover image; identity and place in Runeterra; full-body or three-quarter silhouette; regional backdrop.
- Page 2: wide establishing shot; early life and social role in the region.
- Page 3: champion connection or its first visible consequence; indirect lore details preferred over direct champion depiction.
- Page 4: rising personal conflict becoming unavoidable.
- Page 5: suspense cliffhanger scene; visually dramatize the final shocking beat; not a generic fight unless the story specifically demands it.
- Page 6: immediate consequence of the cliffhanger.
- Page 7: transformation or decisive choice.
- Page 8: open-ended fate; cinematic but unresolved.
- Avoid repeating portrait compositions, backgrounds, and camera angles across pages.

Before returning the final JSON, internally check:
- Is the champion connection canon-safe and light-touch?
- Does the region truly shape the plot?
- Is page 5 a unique cliffhanger rather than a generic trial?
- Would this feel different from ten other generations?

Return strict JSON only.`;

  return { system, user };
}

export function buildFinalImagePrompt(book: LoreBook, page: BookPage) {
  const bible = book.characterBible;
  const direction = page.visualDirection;
  const summary = summarizeForImage(page.text);
  const champion = book.championConnection;

  let championVisualNote = "";
  if (champion?.championName) {
    if (page.pageNumber <= 3) {
      championVisualNote = `Champion connection (indirect visual only): ${champion.championName} — ${champion.connectionSummary}. Show influence through rumor, symbol, aftermath, object, place, light, weapon mark, faction symbol, crowd reaction, banner, or environmental hint. Avoid drawing ${champion.championName} as a clear portrait unless a distant silhouette is essential.`;
    } else if (page.pageNumber === 5) {
      championVisualNote = `This is the cliffhanger page before continuation. The image must dramatize the suspense ending and make the viewer want to know what happens next. Champion connection (${champion.championName}) may echo through a symbol or clue only if relevant to the cliffhanger.`;
    }
  }

  const cliffhangerNote =
    page.pageNumber === 5
      ? "Prioritize the suspense beat and final shocking story moment. This image should feel like a story pause at the edge of revelation."
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

${championVisualNote}

${cliffhangerNote}

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
${IMAGE_STYLE_LOCK}

${IMAGE_STYLE_AVOIDANCES}
Every image must feel like a polished storybook illustration, not a random AI portrait.`;
}

function summarizeForImage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
}
