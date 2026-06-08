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
  const region = chooseRuneterraRegion(input);
  const legendaryTitle = `${input.name}, the ${titleCase(input.tone)} ${titleCase(input.archetype)}`;
  const palette = paletteForRegion(region);
  const anchor = loreAnchorForRegion(region);
  const identity = `${input.gender === "unknown" ? "enigmatic figure" : input.gender} shaped by ${region}, carrying a ${input.archetype}'s bearing`;
  const clothing = clothingForRegion(region, input.archetype);
  const faceAndBody = `alert eyes, solemn expression, resilient posture, carrying the visible weight of ${input.weakness}`;
  const aura = auraForRegion(region, input.tone);
  const symbolicObject = objectForArchetype(input.archetype);

  const book: LoreBook = {
    title: `The Runeterran Chronicle of ${input.name}`,
    subtitle: `A ${input.tone} legend from ${region}, written in shadow, oath, and consequence.`,
    mainRegion: region,
    narratorIntro: `In ${region}, every name carries a debt to history. ${input.name}'s was whispered beside a power no village elder dared to claim.`,
    characterBible: {
      name: input.name,
      legendaryTitle,
      region,
      visualIdentity: identity,
      clothing,
      faceAndBody,
      aura,
      symbolicObject,
      colorPalette: palette,
      worldRules:
        `${anchor} The story follows an original Runeterran figure and does not alter the deeds of known champions.`,
      runeterraLoreAnchor: anchor,
    },
    pages: chapters.map((chapter, index) => {
      const visualDirection = visualDirectionForPage(input, index, region);
      const title = titles(input, index, region);

      return {
        pageNumber: index + 1,
        chapter,
        title,
        text: pageText(input, index, legendaryTitle, region),
        visualDirection,
        imagePrompt: [
          `Full-page illustration for ${chapter}: ${title}.`,
          `Visual story phase: ${visualPhase(input, index, region)}.`,
          `Scene type: ${visualDirection.sceneType}. Camera: ${visualDirection.cameraShot}. Action: ${visualDirection.characterAction}. Environment: ${visualDirection.environment}.`,
          `${identity}, ${faceAndBody}, wearing ${clothing}, aura: ${aura}, symbolic object: ${symbolicObject}, color palette: ${palette}, region: ${region}, Runeterra lore anchor: ${anchor}.`,
          "cinematic League of Legends-inspired fantasy illustration, Runeterra atmosphere, premium storybook art, dramatic lighting, coherent character design, no repeated portrait composition, no generic standing pose, no text, no logos, no watermark",
        ].join(" "),
      };
    }),
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

function chooseRuneterraRegion(input: BookFormInput) {
  if (input.runeterraRegion !== "Auto") {
    return input.runeterraRegion;
  }

  if (input.archetype === "monster" || input.gender === "creature") return "The Void";
  if (input.archetype === "thief" || input.archetype === "assassin" || input.universeStyle === "crime fantasy") {
    return input.tone === "dark" ? "Zaun" : "Bilgewater";
  }
  if (input.archetype === "mage" || input.archetype === "oracle") {
    return input.tone === "noble" ? "Targon" : "Ionia";
  }
  if (input.archetype === "guardian" || input.tone === "heroic" || input.tone === "noble") {
    return input.archetype === "guardian" ? "Demacia" : "Targon";
  }
  if (input.tone === "dark" || input.tone === "cursed" || input.tone === "tragic") {
    return input.tone === "cursed" ? "Shadow Isles" : "Noxus";
  }
  if (input.tone === "mysterious") return "Ionia";

  return "Shurima";
}

function paletteForRegion(region: string) {
  const palettes: Record<string, string> = {
    Demacia: "white stone, royal blue, silver steel, restrained gold",
    Noxus: "black iron, crimson banners, ash gray, war-tarnished bronze",
    Ionia: "spirit blossom pink, jade green, dusk violet, soft gold",
    Piltover: "polished brass, academy blue, cream stone, hextech cyan",
    Zaun: "chemtech green, rusted copper, sump black, toxic amber",
    Shurima: "sun gold, desert ochre, turquoise relic light, ancient sandstone",
    Freljord: "glacial blue, bone white, storm gray, ember orange",
    Bilgewater: "sea black, lantern orange, weathered teal, salt-stained brass",
    Targon: "star silver, midnight blue, cosmic violet, solar gold",
    Ixtal: "jungle emerald, elemental turquoise, obsidian, sunlit gold",
    "Shadow Isles": "spectral green, grave black, ruined silver, cold mist",
    "Bandle City": "dreamlike violet, warm amber, moss green, impossible starlight",
    "The Void": "void purple, abyss black, sickly magenta, alien blue",
  };

  return palettes[region] || "Runeterran gold, deep navy, ancient stone, twilight blue";
}

function loreAnchorForRegion(region: string) {
  const anchors: Record<string, string> = {
    Demacia: "Demacia's fear of magic, rigid honor, petricite traditions, and borderland duty shape this original character.",
    Noxus: "Noxian conquest, ambition, military hierarchy, and the shadow of political orders shape this original character.",
    Ionia: "Ionian spirits, living land, old monasteries, and wounds left by invasion shape this original character.",
    Piltover: "Piltover's progress, invention, social prestige, and Hextech ambition shape this original character.",
    Zaun: "Zaunite survival, Chemtech risk, sump experiments, and class resentment shape this original character.",
    Shurima: "Ancient Shuriman ruins, sun relics, lost empires, and rumors of Ascended power shape this original character.",
    Freljord: "Freljordian tribes, old oaths, brutal winters, and legends of demigods shape this original character.",
    Bilgewater: "Bilgewater's cutthroat ports, sea monsters, relic trade, and pirate codes shape this original character.",
    Targon: "Targon's celestial faiths, Solari and Lunari tensions, and the mountain's impossible trials shape this original character.",
    Ixtal: "Ixtal's elemental mastery, hidden borders, and guarded knowledge shape this original character.",
    "Shadow Isles": "The Black Mist, ruined echoes, curses, and the struggle against undeath shape this original character.",
    "Bandle City": "Bandle City's strange paths, yordle whimsy, and impossible spirit logic shape this original character.",
    "The Void": "Void corruption, impossible hunger, and the terror of what waits beyond reality shape this original character.",
  };

  return anchors[region] || "Runeterra's regional conflicts and old magic shape this original character.";
}

function clothingForRegion(region: string, archetype: string) {
  const clothing: Record<string, string> = {
    Demacia: `petricite-trimmed travel armor and a restrained ${archetype}'s mantle`,
    Noxus: `blackened iron leathers, crimson cloth, and a hard ${archetype}'s silhouette`,
    Ionia: `layered Ionian robes, lacquered guards, and spirit-woven cords`,
    Piltover: `tailored academy fabrics, brass fittings, and subtle hextech details`,
    Zaun: `patched leather, respirator straps, chem-glass vials, and sump-worn layers`,
    Shurima: `sun-bleached wrappings, ancient gold clasps, and desert-worn armor`,
    Freljord: `fur-lined armor, bone charms, and frost-bitten tribal patterns`,
    Bilgewater: `salt-dark coat, brass buckles, sea-worn leather, and hidden knives`,
    Targon: `celestial fabrics, climbing wraps, and star-metal ornaments`,
    Ixtal: `woven jungle armor, elemental stones, and bright ceremonial cords`,
    "Shadow Isles": `torn noble cloth, spectral mail, and mist-stained relic bindings`,
    "Bandle City": `impossible patchwork finery, tiny charms, and dreamlike travel gear`,
    "The Void": `scarred armor fused with alien chitin and torn Runeterran cloth`,
  };

  return clothing[region] || `regional Runeterran clothing with a ${archetype}'s practical details`;
}

function auraForRegion(region: string, tone: string) {
  const aura: Record<string, string> = {
    Demacia: `${tone} petricite glow restrained beneath disciplined breath`,
    Noxus: `${tone} crimson pressure like banners before war`,
    Ionia: `${tone} spirit-light moving like petals on water`,
    Piltover: `${tone} hextech shimmer held behind polished restraint`,
    Zaun: `${tone} chemtech haze flickering through the veins`,
    Shurima: `${tone} sunlit sand and ancient relic radiance`,
    Freljord: `${tone} frostwind aura with ember-deep resolve`,
    Bilgewater: `${tone} lantern smoke and storm-tide omen`,
    Targon: `${tone} celestial light from a distant constellation`,
    Ixtal: `${tone} elemental current coiling through the air`,
    "Shadow Isles": `${tone} Black Mist glow bound to a stubborn living will`,
    "Bandle City": `${tone} impossible shimmer, half dream and half warning`,
    "The Void": `${tone} violet distortion pressing against reality`,
  };

  return aura[region] || `${tone} Runeterran aura shaped by old magic`;
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

function powerForRegion(region: string, archetype: string) {
  const powers: Record<string, string> = {
    Demacia: "a dangerous magic muted by petricite and oathbound discipline",
    Noxus: "blood-warm battle sorcery tempered by ruthless will",
    Ionia: "spirit magic that answers grief, balance, and memory",
    Piltover: "unstable Hextech resonance locked inside a personal relic",
    Zaun: "Chemtech-altered vitality that burns brighter than it should",
    Shurima: "sun-touched relic power awakened from ancient ruins",
    Freljord: "frostborn endurance whispered through old tribal rites",
    Bilgewater: "sea-cursed luck bound to a relic from the deep",
    Targon: "a fragment of celestial radiance earned through suffering",
    Ixtal: "elemental force shaped by hidden axioms and strict focus",
    "Shadow Isles": "a living resistance to the Black Mist's claim",
    "Bandle City": "strange spirit-path magic that refuses ordinary rules",
    "The Void": "a terrifying void-touched mutation fought through will",
  };

  return powers[region] || `${archetype} power shaped by Runeterra's old forces`;
}

function threatForRegion(region: string) {
  const threats: Record<string, string> = {
    Demacia: "fear of magic and a secretive magistrate's suspicion",
    Noxus: "an original warband hungry for status",
    Ionia: "a restless spirit born from old invasion wounds",
    Piltover: "a patron who sees people as inventions to own",
    Zaun: "a Chemtech syndicate with experimental ambitions",
    Shurima: "a tomb-born cult searching for forbidden relics",
    Freljord: "a rival oath-circle hardened by winter and prophecy",
    Bilgewater: "a drowned captain's crew and a debt written in salt",
    Targon: "a zealot faction reading the stars too narrowly",
    Ixtal: "a hidden tribunal guarding elemental secrets",
    "Shadow Isles": "a mistbound wraith seeking a living vessel",
    "Bandle City": "a path between realms opening where it should not",
    "The Void": "a small but growing breach beneath familiar ground",
  };

  return threats[region] || "a lore-compatible regional threat";
}

function titles(input: BookFormInput, index: number, region: string) {
  const list = [
    `The Birth Beneath the Black Star`,
    `The Child of ${region}`,
    `The Scar That Remembered`,
    `The First Omen`,
    `The Awakening of ${titleCase(input.strength)}`,
    `The Shadow Wearing ${titleCase(input.weakness)}`,
    `The Shape of Power`,
    `The Door Left Open`,
  ];

  return list[index];
}

function pageText(input: BookFormInput, index: number, legendaryTitle: string, region: string) {
  const power = powerForRegion(region, input.archetype);
  const threat = threatForRegion(region);
  const pages = [
    `${input.name} was born in ${region} beneath an omen the elders refused to name. A mark like cooled gold rested near the heart, pulsing whenever the child breathed. Some called it a regional superstition, but one silent chronicler wrote that ${legendaryTitle} had entered Runeterra before destiny was ready.`,
    `As a child of ${region}, ${input.name} learned the laws of the land before learning peace. The young ${input.archetype} crossed markets, shrines, alleys, or frozen roads shaped by local fear and pride, carrying ${input.strength} like a hidden candle. Even then, the region seemed to test what the child might become.`,
    `The wound came before glory. A local cruelty, failed oath, or forbidden power left ${input.name} with ${input.weakness} buried deep beneath the ribs. Yet the pain did not end the path. In ${region}, suffering often becomes a weapon, and inside that wound ${input.strength} began to sharpen.`,
    `Years later, the first sign appeared. ${power} stirred when ${input.name} passed, bending the air around ${objectForArchetype(input.archetype)}. No champion came to explain it, and no history changed for them. The omen simply followed the ${input.archetype}, proving Runeterra had noticed another soul at its margins.`,
    `The trial demanded a price. In a forgotten place of ${region}, ${input.name} touched ${objectForArchetype(input.archetype)} and awakened ${power}. It did not arrive as mercy. It arrived as a force to be mastered, binding ${input.strength} to a gift that could save a village or doom it.`,
    `The enemy rose from ${threat}, wearing the shape of ${input.weakness}. It turned neighbors uncertain, roads hostile, and old stories dangerous. ${input.name} understood then that the war was not only against a monster or faction, but against the part of the soul that still believed defeat was deserved.`,
    `Transformation came without applause. The old fear remained, but it no longer ruled. Around ${input.name}, ${power} formed armor, sigil, and flame, changing the ${input.archetype} into a Runeterran legend. Those who had known the wounded child stepped back, seeing a power still choosing what it would become.`,
    `At the final page, ${region} offered no clean ending. A door of ash, stars, mist, or machinery opened before ${input.name}, and beyond it waited a kingdom, curse, or war not yet named. The prophecy ended there, because Runeterra leaves its greatest legends unfinished until they choose to move.`,
  ];

  return pages[index];
}

function visualPhase(input: BookFormInput, index: number, region: string) {
  const phases = [
    `the birth of ${input.name} in ${region} under a black star, elders and regional omens around the newborn`,
    `young ${input.name} growing up in ${region}, discovering the first signs of being a ${input.archetype}`,
    `${input.name} at the moment of the defining wound, surrounded by symbols of ${input.weakness}`,
    `the first supernatural omen appearing before ${input.name}, ${region}'s magic and ancient lights reacting`,
    `${input.name} obtaining powers from ${objectForArchetype(input.archetype)}, energy awakening through the body`,
    `${input.name} facing a ${region} enemy that embodies ${input.weakness}, external threat and inner fear combined`,
    `${input.name} transformed into a legendary ${input.archetype} of ${region}, mastering the awakened power`,
    `${input.name} before a mysterious prophetic door in ${region}, open ending, destiny unresolved`,
  ];

  return phases[index];
}

function visualDirectionForPage(input: BookFormInput, index: number, region: string) {
  const directions = [
    {
      sceneType: "iconic cover image",
      cameraShot: "low-angle full-body silhouette with the protagonist not in close-up",
      characterAction: `${input.name} stands as a strong silhouette before a symbolic ${region} backdrop`,
      environment: `${region} landmark with culture, architecture, or landscape visible behind the protagonist`,
      keyObjects: ["symbolic relic", "regional landmark", "ominous sky"],
      mood: "legendary, mysterious, introductory",
      lighting: "dramatic rim light and deep atmospheric contrast",
    },
    {
      sceneType: "wide establishing shot",
      cameraShot: "wide cinematic shot with the protagonist small in the scene",
      characterAction: `young ${input.name} moves through the origin environment, observing the world that shaped them`,
      environment: `${region} birthplace with architecture, landscape, culture, and daily life details`,
      keyObjects: ["childhood path", "regional buildings", "distant landmark"],
      mood: "formative, grounded, atmospheric",
      lighting: "soft dawn light or misty regional ambience",
    },
    {
      sceneType: "intimate emotional scene",
      cameraShot: "medium environmental shot focused on body language, not a face portrait",
      characterAction: `${input.name} reacts to loss, exile, shame, curse, or the weight of ${input.weakness}`,
      environment: `abandoned or damaged place in ${region} that visually explains the wound`,
      keyObjects: ["broken object", "empty threshold", "long shadow"],
      mood: "wounded, quiet, emotionally heavy",
      lighting: "low side light with heavy shadows",
    },
    {
      sceneType: "supernatural discovery scene",
      cameraShot: "over-the-shoulder or medium-wide shot focused on the omen",
      characterAction: `${input.name} discovers a sign, relic, spirit, rune, vision, or forbidden symbol`,
      environment: `hidden regional site in ${region} where lore-compatible power manifests`,
      keyObjects: ["glowing sign", "ancient relic", "reacting environment"],
      mood: "mysterious, dangerous, awestruck",
      lighting: "unnatural glow cutting through darkness",
    },
    {
      sceneType: "dynamic action scene",
      cameraShot: "dramatic medium-wide action shot with motion blur and strong perspective",
      characterAction: `${input.name} survives a trial by moving, fighting, climbing, escaping, or crossing danger`,
      environment: `hazardous trial ground in ${region} with regional danger and movement`,
      keyObjects: ["weapon or relic", "debris", "non-canon creature or hazard"],
      mood: "urgent, kinetic, perilous",
      lighting: "high-contrast action lighting with sparks, storm, or magical flare",
    },
    {
      sceneType: "confrontation scene",
      cameraShot: "wide confrontation shot with protagonist and original enemy both in frame",
      characterAction: `${input.name} faces an original lore-compatible threat across tense distance`,
      environment: `dramatic confrontation site in ${region} with scale, distance, and opposing silhouettes`,
      keyObjects: ["enemy silhouette", "dividing light", "regional threat symbol"],
      mood: "tense, threatening, monumental",
      lighting: "opposing light sources separating hero and enemy",
    },
    {
      sceneType: "visual transformation scene",
      cameraShot: "medium-wide shot showing the whole transformation context",
      characterAction: `${input.name}'s power awakens as armor, aura, curse, or symbolic object transforms`,
      environment: `${region} setting reacting to the protagonist's power and destiny`,
      keyObjects: ["activating relic", "aura", "environmental reaction"],
      mood: "revelatory, unstable, powerful",
      lighting: "radiant power bloom with atmospheric depth",
    },
    {
      sceneType: "cinematic final scene",
      cameraShot: "epic wide shot from behind or distant side angle",
      characterAction: `${input.name} walks toward or stands before an unresolved legendary threshold`,
      environment: `prophetic horizon, portal, temple, sea, mountain, ruins, celestial gate, or shadowed place in ${region}`,
      keyObjects: ["open threshold", "distant destination", "prophetic sky"],
      mood: "mysterious, open-ended, cinematic",
      lighting: "vast twilight, celestial beam, or horizon glow",
    },
  ];

  return directions[index];
}
