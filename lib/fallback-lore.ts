import type { BookFormInput, LoreBook } from "@/lib/types";

const chapters = [
  "The Name",
  "Origin",
  "The Wound",
  "The Sign",
  "The Trial",
  "The Enemy",
  "The Transformation",
  "The Final Prophecy",
];

export function buildFallbackLoreBook(input: BookFormInput): LoreBook {
  const legendaryTitle = `${input.name}, the ${titleCase(input.tone)} ${titleCase(input.archetype)}`;
  const palette = paletteForStyle(input.universeStyle);
  const identity = `${input.gender === "unknown" ? "enigmatic figure" : input.gender} with a ${input.archetype}'s bearing`;
  const clothing = `weathered ceremonial armor and layered travelling cloth marked by ${input.universeStyle} sigils`;
  const faceAndBody = `alert eyes, solemn expression, resilient posture, carrying the visible weight of ${input.weakness}`;
  const aura = `${input.tone} radiance like cold fire around old stone`;
  const symbolicObject = objectForArchetype(input.archetype);

  const book: LoreBook = {
    title: `The Chronicle of ${input.name}`,
    subtitle: `A ${input.tone} legend from the hidden borders of ${input.universeStyle}.`,
    narratorIntro: `When the archive could not find ink old enough, it carved ${input.name}'s name into shadow and gold.`,
    characterBible: {
      name: input.name,
      legendaryTitle,
      visualIdentity: identity,
      clothing,
      faceAndBody,
      aura,
      symbolicObject,
      colorPalette: palette,
      worldRules:
        "Power answers memory, oaths leave visible marks, and every victory demands a secret price from the soul.",
    },
    pages: chapters.map((chapter, index) => ({
      pageNumber: index + 1,
      chapter,
      title: titles(input, index),
      text: pageText(input, index, legendaryTitle),
      imagePrompt: [
        `Full-page illustration for ${chapter}: ${titles(input, index)}.`,
        `Visual story phase: ${visualPhase(input, index)}.`,
        `${identity}, ${faceAndBody}, wearing ${clothing}, aura: ${aura}, symbolic object: ${symbolicObject}, color palette: ${palette}.`,
        "cinematic dark fantasy illustration, premium storybook art, dramatic lighting, coherent character design, no text, no logos, no watermark",
      ].join(" "),
    })),
  };

  return book;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function paletteForStyle(style: string) {
  if (style.includes("anime")) return "midnight indigo, pale moon blue, ember gold, ink black";
  if (style.includes("gothic")) return "cathedral black, antique ivory, bruised violet, tarnished gold";
  if (style.includes("cosmic")) return "void blue, star silver, eclipse purple, cold gold";
  if (style.includes("crime")) return "wet asphalt black, smoky teal, old blood burgundy, brass gold";
  return "deep navy, charcoal black, aged parchment, muted royal gold";
}

function objectForArchetype(archetype: string) {
  const objects: Record<string, string> = {
    warrior: "a cracked oathblade",
    mage: "a lantern of sealed stars",
    assassin: "a silent obsidian dagger",
    king: "a crown split by frost",
    queen: "a veiled crown of thorned gold",
    wanderer: "a compass that points toward forgotten doors",
    monster: "a bone talisman wrapped in silver thread",
    oracle: "a mirror filled with dark rain",
    thief: "a key carved from moonlit bone",
    guardian: "a shield bearing an unnamed constellation",
  };

  return objects[archetype] || "an ancient relic of unknown purpose";
}

function titles(input: BookFormInput, index: number) {
  const list = [
    `The Birth Beneath the Black Star`,
    `The Child of ${titleCase(input.universeStyle)}`,
    `The Scar That Remembered`,
    `The First Omen`,
    `The Awakening of ${titleCase(input.strength)}`,
    `The Shadow Wearing ${titleCase(input.weakness)}`,
    `The Shape of Power`,
    `The Door Left Open`,
  ];

  return list[index];
}

function pageText(input: BookFormInput, index: number, legendaryTitle: string) {
  const pages = [
    `${input.name} was born when the moon vanished behind a black star and the midwives lowered their voices. A mark like cooled gold rested near the heart, pulsing whenever the child breathed. The elders named it a warning, but one silent archivist wrote that ${legendaryTitle} had entered the world before destiny was ready.`,
    `As a child of ${input.universeStyle}, ${input.name} learned to listen where others only feared silence. The young ${input.archetype} wandered broken courtyards, watched old banners rot, and carried small acts of ${input.strength} like hidden candles. Even then, every kindness seemed to anger the dark, as if the world resisted what the child might become.`,
    `The wound came before glory. Someone trusted was lost, or something sacred was taken, and ${input.weakness} settled into ${input.name} like winter in the bones. Yet the pain did not end the path. It became a secret chamber, and inside it ${input.strength} began to sharpen, slow and dangerous.`,
    `Years later, the first sign appeared. A dead lantern lit itself when ${input.name} passed, and the shadows bent toward the ground like servants. No teacher explained it. No priest claimed it. The omen simply followed the ${input.archetype} through rain and ruin, proving that the unseen powers had finally opened one eye.`,
    `The awakening demanded a price. At the edge of a forbidden shrine, ${input.name} touched ${objectForArchetype(input.archetype)} and felt power answer through blood, breath, and memory. It did not arrive as mercy. It arrived as a storm to be mastered, binding ${input.strength} to a gift that could save or destroy.`,
    `The enemy rose wearing the shape of ${input.weakness}. It spoke with familiar doubts and moved behind every locked gate, turning allies uncertain and roads hostile. ${input.name} understood then that the war was not only against a monster or throne, but against the part of the soul that still believed defeat was deserved.`,
    `Transformation came without applause. The old fear remained, but it no longer ruled. Around ${input.name}, the awakened power formed armor, sigil, and flame, changing the ${input.archetype} into a living legend. Those who had seen the child now stepped back, for the wounded heart had become a crown of night.`,
    `At the final page, the archive refused to close. It showed ${input.name} standing before a door of ash, stars, and unfinished vows. Beyond it waited a kingdom, a curse, or a power with no name. The prophecy ended there, because the next line could only be written by ${input.name}.`,
  ];

  return pages[index];
}

function visualPhase(input: BookFormInput, index: number) {
  const phases = [
    `the birth of ${input.name} under a black star, elders and omens around the newborn`,
    `young ${input.name} growing up in ${input.universeStyle}, discovering the first signs of being a ${input.archetype}`,
    `${input.name} at the moment of the defining wound, surrounded by symbols of ${input.weakness}`,
    `the first supernatural omen appearing before ${input.name}, shadows and ancient lights reacting`,
    `${input.name} obtaining powers from ${objectForArchetype(input.archetype)}, energy awakening through the body`,
    `${input.name} facing the enemy that embodies ${input.weakness}, external threat and inner fear combined`,
    `${input.name} transformed into a legendary ${input.archetype}, mastering the awakened power`,
    `${input.name} before a mysterious prophetic door, open ending, destiny unresolved`,
  ];

  return phases[index];
}
