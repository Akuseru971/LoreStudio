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
    `The Name Beneath the Seal`,
    `Where ${input.name} First Rose`,
    `The Scar That Remembered`,
    `The Omen in ${titleCase(input.universeStyle)}`,
    `The Trial of ${titleCase(input.strength)}`,
    `The Shadow Wearing ${titleCase(input.weakness)}`,
    `The Crown of the Inner Night`,
    `The Door Left Open`,
  ];

  return list[index];
}

function pageText(input: BookFormInput, index: number, legendaryTitle: string) {
  const pages = [
    `${input.name} was not written in ordinary ink. The name appeared beneath a seal of black wax, trembling as if it knew the hand that would break it. Those who read it felt ${input.strength} stir in the dark, and understood that ${legendaryTitle} had been called before the age was ready.`,
    `Before the roads had names, ${input.name} crossed the outer provinces of ${input.universeStyle}, where bells rang for strangers and doors opened only to the brave. A quiet hunger followed every step. It was not ambition, but a need to prove that even ${input.weakness} could become a map toward power.`,
    `The first wound did not bleed. It spoke. It whispered of ${input.weakness}, of every hour when ${input.name} nearly turned away from the path. Yet the wound became a hidden shrine, and within it burned ${input.strength}, small as a coal, stubborn enough to outlast winter.`,
    `On the seventh dusk, the sky bent low and marked ${input.name} with an omen. Ravens circled without wings, candles burned blue under rain, and the old stones leaned closer. The sign promised no safety. It only revealed that the world had noticed, and that notice was never given freely.`,
    `The trial came dressed as mercy. ${input.name} was offered rest, praise, and a golden road away from danger. But legends are not made by comfort. With ${input.strength} held like a blade against the ribs, the ${input.archetype} stepped forward and paid with silence, memory, and sleep.`,
    `The enemy had no single face. It wore every doubt that ${input.weakness} had ever planted, every voice that called the dream foolish. In the halls beneath the archive, ${input.name} met that shadow and did not destroy it. Instead, the shadow was named, and naming made it kneel.`,
    `What rose afterward was not the same soul that entered. ${input.name} carried the old fear, but it had changed shape, becoming armor with a living pulse. The air darkened around the ${input.archetype}, and even the distant stars seemed to bow toward a power still learning its own name.`,
    `At the final page, the archive refused to close. It showed ${input.name} a door standing alone in a field of ash and moonlit flowers. Beyond it waited a crown, a curse, or a kingdom not yet born. The prophecy ended there, because some legends must be opened by hand.`,
  ];

  return pages[index];
}
