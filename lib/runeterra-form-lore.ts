import { characterTypes, runeterraRegions } from "@/lib/utils";

export type RegionLoreEntry = {
  description: string;
  image: string;
  mood: string;
};

export type CharacterTypeLoreEntry = {
  description: string;
  champion: string;
  championTitle: string;
  championImage: string;
};

const REGION_IMAGE_BASE = "/runeterra/regions";
const CHAMPION_IMAGE_BASE = "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion";

export const REGION_LORE: Record<(typeof runeterraRegions)[number], RegionLoreEntry> = {
  Auto: {
    description:
      "No region is chosen yet. The archive will follow whichever corner of Runeterra best suits your legend.",
    image: `${REGION_IMAGE_BASE}/auto.svg`,
    mood: "All of Runeterra",
  },
  Demacia: {
    description:
      "A proud kingdom of white stone and petricite, where duty, honor, and fear of magic shape every oath.",
    image: `${REGION_IMAGE_BASE}/demacia.svg`,
    mood: "Honor and petricite",
  },
  Noxus: {
    description:
      "An expanding empire built on strength and ambition, where weakness is forgotten and victory is law.",
    image: `${REGION_IMAGE_BASE}/noxus.svg`,
    mood: "Strength above all",
  },
  Ionia: {
    description:
      "A land of sacred gardens, living spirit, and fragile balance, where one choice can ripple across the entire province.",
    image: `${REGION_IMAGE_BASE}/ionia.svg`,
    mood: "Balance and spirit",
  },
  Piltover: {
    description:
      "The progressive City of Progress, glittering with hextech workshops, trade towers, and dangerous new inventions.",
    image: `${REGION_IMAGE_BASE}/piltover.svg`,
    mood: "Innovation and commerce",
  },
  Zaun: {
    description:
      "A toxic undercity beneath Piltover, where chem-industry, survival, and rebellion burn in green neon haze.",
    image: `${REGION_IMAGE_BASE}/zaun.svg`,
    mood: "Chem-fog and defiance",
  },
  Shurima: {
    description:
      "A sun-scorched empire of ancient ascended ruins, buried gods, and caravans crossing endless golden dunes.",
    image: `${REGION_IMAGE_BASE}/shurima.svg`,
    mood: "Sun and fallen empire",
  },
  Freljord: {
    description:
      "A frozen frontier of clans, demigods, and old ice, where survival is worship and every winter tells a story.",
    image: `${REGION_IMAGE_BASE}/freljord.svg`,
    mood: "Ice and old gods",
  },
  Bilgewater: {
    description:
      "A brutal island port of pirates, monster hunters, and black-market trade, ruled by fear and opportunity.",
    image: `${REGION_IMAGE_BASE}/bilgewater.svg`,
    mood: "Salt, steel, and superstition",
  },
  Targon: {
    description:
      "A mountain realm touching the celestial heights, where star-forged warriors and cosmic faith reshape mortal fate.",
    image: `${REGION_IMAGE_BASE}/targon.svg`,
    mood: "Stars and ascension",
  },
  Ixtal: {
    description:
      "A hidden jungle civilization mastering elemental brujacraft, fiercely guarding its secrets from the outside world.",
    image: `${REGION_IMAGE_BASE}/ixtal.svg`,
    mood: "Elemental secrecy",
  },
  "Shadow Isles": {
    description:
      "A cursed archipelago drowned in Black Mist, where the dead do not rest and every shore remembers betrayal.",
    image: `${REGION_IMAGE_BASE}/shadow-isles.svg`,
    mood: "Mist and undeath",
  },
  "Bandle City": {
    description:
      "A whimsical yordle realm of impossible geometry and bright mischief, where laughter hides surprising danger.",
    image: `${REGION_IMAGE_BASE}/bandle-city.svg`,
    mood: "Whimsy and wonder",
  },
  "The Void": {
    description:
      "A hungry nothing between worlds, birthing horrors that unravel reality wherever the rift-touched tread.",
    image: `${REGION_IMAGE_BASE}/the-void.svg`,
    mood: "Corruption and hunger",
  },
};

export const REGION_CHAMPIONS: Record<(typeof runeterraRegions)[number], string[]> = {
  Auto: [],
  Demacia: ["Lux", "Garen", "Jarvan IV", "Sylas", "Fiora", "Galio", "Poppy", "Vayne", "Shyvana"],
  Noxus: ["Darius", "Draven", "Swain", "Katarina", "Talon", "Riven", "Samira", "LeBlanc", "Sion"],
  Ionia: [
    "Irelia",
    "Yasuo",
    "Yone",
    "Ahri",
    "Karma",
    "Shen",
    "Zed",
    "Akali",
    "Master Yi",
    "Wukong",
    "Sett",
    "Syndra",
    "Varus",
    "Xayah",
    "Rakan",
  ],
  Piltover: ["Caitlyn", "Vi", "Jayce", "Ezreal", "Camille", "Seraphine", "Heimerdinger", "Orianna"],
  Zaun: ["Jinx", "Ekko", "Viktor", "Warwick", "Singed", "Twitch", "Zac", "Renata Glasc", "Dr. Mundo"],
  Shurima: ["Azir", "Nasus", "Renekton", "Sivir", "Taliyah", "Xerath", "Amumu", "Rammus", "Naafiri", "K'Sante"],
  Freljord: [
    "Ashe",
    "Sejuani",
    "Lissandra",
    "Braum",
    "Tryndamere",
    "Olaf",
    "Anivia",
    "Ornn",
    "Volibear",
    "Udyr",
    "Nunu & Willump",
    "Trundle",
  ],
  Bilgewater: ["Miss Fortune", "Gangplank", "Twisted Fate", "Graves", "Illaoi", "Pyke", "Nautilus", "Tahm Kench", "Fizz"],
  Targon: ["Leona", "Diana", "Pantheon", "Taric", "Soraka", "Zoe", "Aurelion Sol", "Aphelios"],
  Ixtal: ["Qiyana", "Milio", "Neeko", "Nidalee", "Zyra", "Rengar", "Malphite"],
  "Shadow Isles": ["Viego", "Thresh", "Kalista", "Hecarim", "Karthus", "Yorick", "Gwen", "Maokai", "Vex", "Elise"],
  "Bandle City": ["Teemo", "Tristana", "Lulu", "Veigar", "Corki", "Rumble", "Yuumi", "Kennen", "Poppy", "Vex"],
  "The Void": ["Kai'Sa", "Kassadin", "Malzahar", "Vel'Koz", "Rek'Sai", "Kha'Zix", "Cho'Gath", "Bel'Veth"],
};

export const CHARACTER_TYPE_LORE: Record<(typeof characterTypes)[number], CharacterTypeLoreEntry> = {
  Warrior: {
    description: "Front-line fighters who meet danger with steel, discipline, and unbroken resolve.",
    champion: "Garen",
    championTitle: "The Might of Demacia",
    championImage: `${CHAMPION_IMAGE_BASE}/Garen.png`,
  },
  Mage: {
    description: "Arcane wielders who bend elements, light, and forbidden knowledge to their will.",
    champion: "Lux",
    championTitle: "The Lady of Luminosity",
    championImage: `${CHAMPION_IMAGE_BASE}/Lux.png`,
  },
  Assassin: {
    description: "Silent predators who end conflicts with precision, shadow, and one decisive strike.",
    champion: "Zed",
    championTitle: "The Master of Shadows",
    championImage: `${CHAMPION_IMAGE_BASE}/Zed.png`,
  },
  Guardian: {
    description: "Protectors who shield the vulnerable with shield, story, and immovable courage.",
    champion: "Braum",
    championTitle: "The Heart of the Freljord",
    championImage: `${CHAMPION_IMAGE_BASE}/Braum.png`,
  },
  Wanderer: {
    description: "Travelers shaped by road, exile, and discovery, carrying no home but their purpose.",
    champion: "Taliyah",
    championTitle: "The Stoneweaver",
    championImage: `${CHAMPION_IMAGE_BASE}/Taliyah.png`,
  },
  Inventor: {
    description: "Builders and tinkerers who solve impossible problems with craft, theory, and risky prototypes.",
    champion: "Heimerdinger",
    championTitle: "The Revered Inventor",
    championImage: `${CHAMPION_IMAGE_BASE}/Heimerdinger.png`,
  },
  Healer: {
    description: "Compassionate figures who mend bodies, spirits, and broken communities alike.",
    champion: "Soraka",
    championTitle: "The Starchild",
    championImage: `${CHAMPION_IMAGE_BASE}/Soraka.png`,
  },
  Oracle: {
    description: "Seers and guides who read omens, memory, and fate to warn those who will listen.",
    champion: "Karma",
    championTitle: "The Enlightened One",
    championImage: `${CHAMPION_IMAGE_BASE}/Karma.png`,
  },
  Hunter: {
    description: "Trackers who survive by patience, instinct, and knowing exactly when to loose the arrow.",
    champion: "Ashe",
    championTitle: "The Frost Archer",
    championImage: `${CHAMPION_IMAGE_BASE}/Ashe.png`,
  },
  Noble: {
    description: "Heirs of title and burden, raised to lead houses, armies, or ideals larger than themselves.",
    champion: "JarvanIV",
    championTitle: "The Exemplar of Demacia",
    championImage: `${CHAMPION_IMAGE_BASE}/JarvanIV.png`,
  },
  Thief: {
    description: "Outcasts and infiltrators who survive by wit, silence, and taking what power hoards.",
    champion: "Talon",
    championTitle: "The Blade's Shadow",
    championImage: `${CHAMPION_IMAGE_BASE}/Talon.png`,
  },
  Monster: {
    description: "Creatures and horrors whose legend is written in teeth, hunger, and primal terror.",
    champion: "RekSai",
    championTitle: "The Void Burrower",
    championImage: `${CHAMPION_IMAGE_BASE}/RekSai.png`,
  },
  "Spirit-Bound": {
    description: "Souls tied to oath, memory, or the unseen, walking between grief and unfinished duty.",
    champion: "Yasuo",
    championTitle: "The Unforgiven",
    championImage: `${CHAMPION_IMAGE_BASE}/Yasuo.png`,
  },
  Soldier: {
    description: "Rank-and-file warriors forged by war camps, banners, and the cost of conquest.",
    champion: "Darius",
    championTitle: "The Hand of Noxus",
    championImage: `${CHAMPION_IMAGE_BASE}/Darius.png`,
  },
  Scholar: {
    description: "Thinkers who pursue truth through study, archives, and dangerous new understanding.",
    champion: "Viktor",
    championTitle: "The Herald of the Arcane",
    championImage: `${CHAMPION_IMAGE_BASE}/Viktor.png`,
  },
  Pirate: {
    description: "Sea wolves and captains who live by tide, blade, and the promise of buried fortune.",
    champion: "MissFortune",
    championTitle: "The Bounty Hunter",
    championImage: `${CHAMPION_IMAGE_BASE}/MissFortune.png`,
  },
  "Chemtech Survivor": {
    description: "Zaunite survivors marked by chem-alchemy, mutation, and life beneath the undercity.",
    champion: "Jinx",
    championTitle: "The Loose Cannon",
    championImage: `${CHAMPION_IMAGE_BASE}/Jinx.png`,
  },
  "Void-Touched": {
    description: "Mortals altered by the Void's hunger, forever balancing humanity against cosmic corruption.",
    champion: "Kaisa",
    championTitle: "Daughter of the Void",
    championImage: `${CHAMPION_IMAGE_BASE}/Kaisa.png`,
  },
  Vastaya: {
    description: "Shape-shifting descendants of magic and wild spirit, bound to nature and old bloodlines.",
    champion: "Ahri",
    championTitle: "The Nine-Tailed Fox",
    championImage: `${CHAMPION_IMAGE_BASE}/Ahri.png`,
  },
  "Ascended Disciple": {
    description: "Followers of Shuriman ascension, touched by sun-ritual, god-memory, and imperial legacy.",
    champion: "Nasus",
    championTitle: "The Curator of the Sands",
    championImage: `${CHAMPION_IMAGE_BASE}/Nasus.png`,
  },
};

const CHAMPION_IMAGE_OVERRIDES: Record<string, string> = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  ksante: "KSante",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  nunu: "Nunu",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  xinzhao: "XinZhao",
};

function normalizeChampionLookupKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''.]/g, "")
    .replace(/&/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

function toDdragonChampionId(name: string) {
  const normalized = normalizeChampionLookupKey(name);
  if (CHAMPION_IMAGE_OVERRIDES[normalized]) {
    return CHAMPION_IMAGE_OVERRIDES[normalized];
  }

  const compact = name.replace(/[^a-zA-Z]/g, "");
  return compact || null;
}

export function getChampionImage(championName: string): string | null {
  const championId = toDdragonChampionId(championName);
  if (!championId) {
    return null;
  }

  return `${CHAMPION_IMAGE_BASE}/${championId}.png`;
}

export function getRegionLore(region: string): RegionLoreEntry | null {
  if (!region) {
    return null;
  }

  return REGION_LORE[region as keyof typeof REGION_LORE] ?? null;
}

export function getRegionChampions(region: string): string[] {
  if (!region) {
    return [];
  }

  return REGION_CHAMPIONS[region as keyof typeof REGION_CHAMPIONS] ?? [];
}

export function getCharacterTypeLore(characterType: string): CharacterTypeLoreEntry | null {
  if (!characterType) {
    return null;
  }

  return CHARACTER_TYPE_LORE[characterType as keyof typeof CHARACTER_TYPE_LORE] ?? null;
}
