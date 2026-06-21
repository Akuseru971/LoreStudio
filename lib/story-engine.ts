export const STORY_ARCHETYPES = [
  "The Public Lie — the world remembers the protagonist for something they never actually did.",
  "The Wrong Witness — false testimony about a legendary event changed lives.",
  "The Living Law — the protagonist embodies a local rule, tradition, sentence, or curse.",
  "The Inherited Enemy — born into a conflict everyone else understands except them.",
  "The Failed Saint — tried to save people and became feared because of the method.",
  "The Disappearing Profession — belongs to a trade with no place in a changing region.",
  "The Political Accident — importance comes from bureaucracy, border shift, or military error.",
  "The Unwanted Miracle — something miraculous ruins position, family, or reputation.",
  "The Famous Nobody — everyone knows the result of their actions, almost no one knows their name.",
  "The Enemy's Mercy — survives because an enemy spared them, and that mercy becomes unbearable.",
  "The Manufactured Hero — a city, army, clan, or cult turns them into a symbol they never wanted.",
  "The Broken Function — trained for one purpose, but the world made that purpose dangerous.",
  "The Inverted Monster — called monstrous for doing something morally understandable.",
  "The Local Myth — a small regional rumor becomes larger than the truth.",
  "The Person Who Refused the Legend — repeatedly avoids importance, but history keeps using them.",
  "The Consequence of Someone Else's Glory — shaped by collateral effects of a champion's fame.",
  "The Devoted Coward — defining act comes from fear, not bravery.",
  "The Useful Betrayal — a practical betrayal saves more people than loyalty would have.",
  "The Profession That Became a Weapon — a harmless skill becomes terrifying in war, politics, or faith.",
  "The Ritual That Failed Correctly — a ceremony fails but reveals the real truth.",
] as const;

export const BANNED_STORY_DEVICE_PATTERNS = [
  /\bhidden object\b/i,
  /\bancient relic\b/i,
  /\bold debt\b/i,
  /\bsecret promise\b/i,
  /\bmysterious map\b/i,
  /\bsealed door\b/i,
  /\bforgotten letter\b/i,
  /\bchampion(?:'s)? seal\b/i,
  /\bclue left by\b/i,
  /\bprophecy\b/i,
  /\bchosen one\b/i,
  /\bcursed bloodline\b/i,
  /\bunknown parentage\b/i,
  /\bmagical mark\b/i,
  /\bwhispering artifact\b/i,
  /\bshadow(?:s)? (?:called|answered|spoke)\b/i,
  /\bsecret faction\b/i,
  /\bthe device spoke (?:their|his|her) name\b/i,
  /\bthe door opened\b/i,
  /\bthe map led to\b/i,
  /\bthe truth was hidden beneath\b/i,
  /\bthe symbol belonged to\b/i,
  /\bthe pattern broke\b/i,
  /\bfate shifted\b/i,
  /\bthe trial began\b/i,
  /\bleft (?:an|a) index\b/i,
  /\btrace of (?:the )?champion\b/i,
  /\bletter from (?:the )?champion\b/i,
  /\bmap (?:to|leading to) (?:the )?champion\b/i,
  /\bchampion secretly noticed\b/i,
  /\bchampion directly chose\b/i,
];

export const CHAMPION_CONNECTION_TYPES = [
  "A champion's public actions created the system that shaped the protagonist.",
  "A champion's reputation distorted how others treated the protagonist.",
  "A war involving a champion changed the protagonist's profession.",
  "A champion became a political excuse used against the protagonist.",
  "A champion's ideology inspired people around the protagonist.",
  "The protagonist is mistaken for someone connected to the champion.",
  "The protagonist becomes useful because of a misunderstanding about the champion.",
  "The protagonist's life is damaged by consequences of a champion's legend.",
  "The protagonist opposes what people believe the champion represents.",
  "The protagonist benefits from a reform, fear, conflict, or rumor caused by the champion.",
];

export const IMAGE_PROMPT_RULES = `Image prompt rules:
- Illustrate a concrete social scene from the biography moment on that page.
- Show profession, public event, court, harbor, hospital, temple, market, archive, prison, guild, caravan, theater, or ritual when relevant.
- Include specific regional details and emotional consequence.
- Avoid generic mist portraits, glowing relics, sealed doors, mysterious maps, hooded figures with symbols, and shadowy alleys every time.
- Every imagePrompt must include visual consistency from visualBible.
- Every imagePrompt must include: cinematic League of Legends-inspired fantasy illustration, premium illustrated storybook art.
- No written text inside the image.`;

export const ANTI_REPETITION_VALIDATION = `Before returning JSON, validate the story. Reject and rewrite completely with a different archetype if any are true:
- contains a hidden object, secret debt, old promise, relic hunt, map clue, or sealed door
- contains a letter, seal, clue, or trace left by a champion
- contains prophecy or chosen-one logic
- page 5 is only an object reveal
- the champion connection feels like a clue instead of structural, social, political, or reputational influence
- the protagonist becomes a generic warrior, mage, or exile without a specific role
- titles sound generic or templated
- the story could be swapped to any region without changing much
- the biography lacks a strong central irony
- pages feel like the same template rhythm every time`;

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickStoryArchetype(seed: string) {
  const index = hashSeed(seed) % STORY_ARCHETYPES.length;
  return STORY_ARCHETYPES[index];
}

export function findBannedStoryDevices(text: string) {
  return BANNED_STORY_DEVICE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

export function validateGeneratedStory(book: {
  pages?: Array<{ text?: string; title?: string }>;
  storyEngine?: { centralIrony?: string; archetype?: string };
}) {
  const issues: string[] = [];
  const combinedText = (book.pages || []).map((page) => `${page.title || ""} ${page.text || ""}`).join(" ");

  for (const device of findBannedStoryDevices(combinedText)) {
    issues.push(`Banned story device detected: ${device}`);
  }

  if (!book.storyEngine?.centralIrony?.trim()) {
    issues.push("Missing central irony in storyEngine.");
  }

  if (!book.storyEngine?.archetype?.trim()) {
    issues.push("Missing archetype in storyEngine.");
  }

  return issues;
}
