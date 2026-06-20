import { IMAGE_STYLE_AVOIDANCES, IMAGE_STYLE_LOCK } from "@/lib/prompts";
import { pickStoryArchetype } from "@/lib/story-engine";
import type { BookFormInput, LoreBook } from "@/lib/types";
import { normalizeLoreBook } from "@/lib/utils";

const PAGE_TITLES = [
  "A Medal for the Wrong Man",
  "The Census That Named Her Twice",
  "Smoke Over the Lower Lanes",
  "A Law That Needed a Monster",
  "Seven Names on a City Bill",
  "The Choir That Named Her Traitor",
  "The Surgeon Who Refused Glory",
  "A Crown Worn by Rumor",
];

const REGION_CHAMPIONS: Record<string, { name: string; connectionType: string; summary: string }> = {
  Noxus: {
    name: "Swain",
    connectionType: "political reform and public memory",
    summary:
      "Swain's census reforms made every citizen legible to the state, and the protagonist's ordinary paperwork became proof of a lie the empire preferred to keep.",
  },
  Demacia: {
    name: "Lux",
    connectionType: "public fear of forbidden light",
    summary:
      "After Lux became a symbol of forbidden magic, neighbors began treating any honest mistake as evidence of treason, and the protagonist's life narrowed around denunciations.",
  },
  Zaun: {
    name: "Ekko",
    connectionType: "aftermath of urban resistance",
    summary:
      "Ekko never entered the story directly, but the city's memory of his firefight turned every repair crew into suspects and every delay into betrayal.",
  },
  Piltover: {
    name: "Jayce",
    connectionType: "innovation as public propaganda",
    summary:
      "Jayce's progress became the city's religion, and the protagonist's modest craft was rebranded as evidence of sabotage whenever the council needed a scapegoat.",
  },
  Ionia: {
    name: "Karma",
    connectionType: "spiritual politics after war",
    summary:
      "Karma's sermons taught Ionia to forgive in public and punish in private, and the protagonist was praised for mercy they never offered.",
  },
  Shurima: {
    name: "Azir",
    connectionType: "restored imperial myth",
    summary:
      "Azir's return rewrote every ruin into prophecy, and the protagonist's family was taxed for loyalty to a empire they had never seen.",
  },
  Freljord: {
    name: "Ashe",
    connectionType: "unity imposed by rumor",
    summary:
      "Ashe's peace talks were sung in every longhouse, but the protagonist was exiled for refusing to swear to a truce that would have starved their tribe.",
  },
  Bilgewater: {
    name: "Miss Fortune",
    connectionType: "reputation as law",
    summary:
      "Miss Fortune's reign taught Bilgewater that names could be inherited like debts, and the protagonist was promoted for surviving a massacre they did not cause.",
  },
  "Shadow Isles": {
    name: "Thresh",
    connectionType: "fear reshaping local ritual",
    summary:
      "Thresh's legend turned every lantern into a warning, and the protagonist became the island's reluctant witness because they alone refused to embellish the dead.",
  },
  Ixtal: {
    name: "Qiyana",
    connectionType: "aristocratic spectacle",
    summary:
      "Qiyana's court taught Ixtal that beauty was proof of worth, and the protagonist's plain competence became an insult to nobles who needed miracles.",
  },
  Targon: {
    name: "Leona",
    connectionType: "faith weaponized by distance",
    summary:
      "Leona's radiance was invoked in every oath, and the protagonist was condemned for shielding a heretic the sun priests had already decided to burn.",
  },
  "Bandle City": {
    name: "Lulu",
    connectionType: "whimsy used to dismiss truth",
    summary:
      "Lulu's pranks became the explanation for every inconvenient fact, and the protagonist was laughed out of council for describing danger too plainly.",
  },
  "The Void": {
    name: "Kai'Sa",
    connectionType: "survival myth misunderstood",
    summary:
      "Kai'Sa's survival was turned into a sermon about sacrifice, and the protagonist was drafted because command believed anyone from the wastes must be expendable.",
  },
};

export function buildFallbackLoreBook(input: BookFormInput): LoreBook {
  const region = chooseRegion(input);
  const champion = REGION_CHAMPIONS[region] || REGION_CHAMPIONS.Noxus;
  const archetype = pickStoryArchetype(`${input.name}:${region}:${input.characterType}`);
  const socialRole = socialRoleFor(input.characterType);
  const subtitle = `The ${socialRole} ${region} Could Not Forget`;

  const rawBook = {
    title: input.name,
    subtitle,
    region,
    genre: "in-world biography",
    storyEngine: {
      archetype,
      centralIrony: `${input.name} is publicly admired for an act they did not commit.`,
      publicReputation: `a local ${socialRole} celebrated for steadiness`,
      privateTruth: "they survived by making the choice no one wanted to name",
      socialPressure: `the institutions of ${region} needed a simple story after recent unrest`,
      irreversibleEvent: "they signed a record they knew was false and saved a district by doing it",
      championConnectionType: champion.connectionType,
      finalContradiction: "they became indispensable by letting the world misremember them",
    },
    championConnection: {
      championName: champion.name,
      connectionType: champion.connectionType,
      connectionSummary: champion.summary,
      whyItMatters: `Without meeting ${champion.name}, the machinery of reputation in ${region} still reshaped every choice ${input.name} could make.`,
      canonSafetyNote: "The protagonist remains original and no major canon events were altered.",
    },
    visualBible: {
      appearance: `${input.gender === "creature" ? "an unusual figure" : `a ${input.gender}`} with the tired precision of a ${socialRole}`,
      clothing: workClothesFor(region, input.characterType),
      regionAtmosphere: `crowded civic life in ${region}, paperwork, banners, and tired officials`,
      colorPalette: paletteFor(region),
      recurringVisualMotif: "a stamped document folded into a coat pocket",
    },
    pages: PAGE_TITLES.map((title, index) => ({
      pageNumber: index + 1,
      title,
      text: pageText(index, input.name, region, socialRole, champion.name),
      imagePrompt: imagePromptFor(index + 1, title, region, socialRole),
    })),
  };

  return normalizeLoreBook({
    ...rawBook,
    characterBible: {
      name: input.name,
      gender: input.gender,
      characterType: input.characterType,
      legendaryTitle: subtitle,
      region,
      socialRole,
      visualIdentity: rawBook.visualBible.appearance,
      clothing: rawBook.visualBible.clothing,
      faceAndBody: rawBook.visualBible.appearance,
      aura: rawBook.visualBible.regionAtmosphere,
      symbolicObject: rawBook.visualBible.recurringVisualMotif,
      colorPalette: rawBook.visualBible.colorPalette,
      worldRules: "Runeterra remembers people through consequence, reputation, and the stories others need to believe.",
      runeterraLoreAnchor: rawBook.visualBible.regionAtmosphere,
    },
  } as Parameters<typeof normalizeLoreBook>[0]);
}

function chooseRegion(input: BookFormInput) {
  if (input.runeterraRegion !== "Auto") {
    return input.runeterraRegion;
  }

  const map: Record<string, string> = {
    Warrior: "Noxus",
    Mage: "Ionia",
    Assassin: "Noxus",
    Guardian: "Demacia",
    Wanderer: "Shurima",
    Inventor: "Piltover",
    Healer: "Ionia",
    Oracle: "Targon",
    Hunter: "Freljord",
    Noble: "Demacia",
    Thief: "Bilgewater",
    Monster: "Shadow Isles",
    "Spirit-Bound": "Shadow Isles",
    Soldier: "Noxus",
    Scholar: "Piltover",
    Pirate: "Bilgewater",
    "Chemtech Survivor": "Zaun",
    "Void-Touched": "The Void",
    Vastaya: "Ionia",
    "Ascended Disciple": "Shurima",
  };

  return map[input.characterType] || "Noxus";
}

function socialRoleFor(characterType: string) {
  const roles: Record<string, string> = {
    Warrior: "regimental clerk",
    Mage: "temple copyist",
    Assassin: "harbor tally-keeper",
    Guardian: "bridge warden",
    Wanderer: "caravan medic",
    Inventor: "patent scribe",
    Healer: "ward nurse",
    Oracle: "court interpreter",
    Hunter: "ice-road guide",
    Noble: "estate auditor",
    Thief: "dockside broker",
    Monster: "charnel registrar",
    "Spirit-Bound": "funeral chanter",
    Soldier: "supply quartermaster",
    Scholar: "archive indexer",
    Pirate: "customs translator",
    "Chemtech Survivor": "sump inspector",
    "Void-Touched": "quarantine recorder",
    Vastaya: "river census-taker",
    "Ascended Disciple": "ruin surveyor",
  };

  return roles[characterType] || "municipal clerk";
}

function workClothesFor(region: string, characterType: string) {
  return `practical ${region} work clothes suited to a ${characterType.toLowerCase()}, stained with ink, weather, and long shifts`;
}

function paletteFor(region: string) {
  const palettes: Record<string, string> = {
    Noxus: "iron gray, dried blood red, soot black, dull brass",
    Demacia: "pale stone, navy blue, wheat gold, polished steel",
    Zaun: "chem-green haze, rust brown, lamp amber, pipe copper",
    Piltover: "brass, cobalt glass, marble white, coal smoke",
    Ionia: "jade mist, blossom pink, river teal, temple gold",
    Shurima: "sun-bleached sand, lapis, bronze, bone white",
    Freljord: "ice blue, wolf fur gray, pine black, hearth ember",
    Bilgewater: "tar black, sea foam, coin gold, storm purple",
    "Shadow Isles": "mourning green, grave iron, lantern gold, mist white",
    Ixtal: "jungle jade, clay red, obsidian, ritual gold",
    Targon: "star silver, dawn rose, mountain stone, sun white",
    "Bandle City": "moss green, berry violet, lantern yellow, mushroom cream",
    "The Void": "violet black, chitin purple, ash gray, sickly teal",
  };

  return palettes[region] || "deep navy, charcoal black, parchment, muted gold";
}

function pageText(
  index: number,
  name: string,
  region: string,
  socialRole: string,
  championName: string,
) {
  const texts = [
    `${name} kept ${region}'s records straight long before anyone called them brave. As a ${socialRole}, they knew every name in the district and which families could survive one more bad season.`,
    `When riots emptied the lower lanes, ${name} stayed at the desk and moved refugees through the only ledger the council would accept. Neighbors began saying the city still stood because ${name} never slept.`,
    `The truth was uglier. ${name} had redirected grain manifests to starving wards by falsifying signatures they could not admit aloud. The error held for three nights and kept four hundred people alive.`,
  `Officials needed a hero after the fires, and ${name}'s exhausted face fit the poster. They were photographed beside medals they never earned while the real rescuers were buried without names.`,
    `On the week ${championName}'s reforms reached ${region}, ${name}'s forged entries became the example every clerk was ordered to emulate. The council announced that ${name}'s methods would be taught in every bureau, and the first student was the investigator sent to expose them.`,
    `The exposure did not arrive as punishment. It arrived as promotion. ${name} was named liaison to the reform office because their fraud had accidentally fulfilled a policy no one else could implement.`,
    `They tried to confess and were told the confession would kill the peace. So ${name} learned to speak in the language of public virtue while privately counting every life their lie had bought.`,
    `Now ${name} walks ${region} as a living lesson in useful memory. The city praises them for courage they never had, and they keep signing papers because the day they stop, the people they saved will be erased again.`,
  ];

  return texts[index] || texts[0];
}

function imagePromptFor(pageNumber: number, title: string, region: string, socialRole: string) {
  return [
    `Full-page illustrated biography scene for Page ${pageNumber}: ${title}.`,
    `Show a concrete civic moment in ${region} involving a ${socialRole}.`,
    "Medium-wide documentary composition with officials, neighbors, paperwork, banners, or public ceremony.",
    "No glowing relics, sealed doors, mysterious maps, or hooded mist portraits.",
    IMAGE_STYLE_LOCK,
    IMAGE_STYLE_AVOIDANCES,
  ].join(" ");
}
