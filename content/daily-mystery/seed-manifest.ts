import type { ManualManifestEntry } from "@/lib/daily-mystery/importer/ddragon";
import { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";

const DDRAGON_VERSION = "16.14.1";

export const IRELIA_TEST_PASSAGE = `In the wake of the Noxian invasion, Irelia forged a new path for the people of Ionia. Swain's legions had carved through the province, yet Karma's teachings still echoed among the survivors. The Blade Dancer refused to let Noxus claim the spirit of her homeland.`;

function championSeed({
  id,
  name,
  title,
  lore,
  regionTags,
  difficulty = 3,
  aliases = [],
}: {
  id: string;
  name: string;
  title: string;
  lore: string;
  regionTags: string[];
  difficulty?: number;
  aliases?: string[];
}): ManualManifestEntry {
  const slug = `champion-${id.toLowerCase()}`;
  const sourceUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion/${id}.json`;
  return {
    slug,
    target_type: "champion",
    canonical_title: name,
    protected_terms: buildChampionProtectedTerms(name, [title, ...aliases]),
    accepted_solution_aliases: [title.toLowerCase(), ...aliases.map((alias) => alias.toLowerCase())],
    source_text: lore,
    source_url: sourceUrl,
    source_type: "full_biography",
    locale: "en_US",
    difficulty,
    region_tags: regionTags,
    related_champion_ids: [id],
    riot_content_version: DDRAGON_VERSION,
    ddragon_version: DDRAGON_VERSION,
    hint_metadata: {
      category_label: "champion",
      region_label: regionTags[0],
      period_label: "A defining chapter in Runeterra's history.",
    },
    review_status: "approved",
  };
}

export const verifiedSeedManifest: ManualManifestEntry[] = [
  {
    slug: "champion-irelia-test",
    target_type: "champion",
    canonical_title: "Irelia",
    protected_terms: ["Irelia", "Irelia's", "Xan Irelia", "The Blade Dancer"],
    accepted_solution_aliases: ["the blade dancer", "xan irelia"],
    source_text: IRELIA_TEST_PASSAGE,
    source_url: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion/Irelia.json`,
    source_type: "full_biography",
    locale: "en_US",
    difficulty: 3,
    region_tags: ["Ionia"],
    related_champion_ids: ["Irelia"],
    ddragon_version: DDRAGON_VERSION,
    hint_metadata: {
      category_label: "champion",
      region_label: "Ionia",
      period_label: "After the Noxian invasion of Ionia",
      multiple_choice_options: ["Irelia", "Swain", "Karma", "Darius"],
    },
    review_status: "approved",
  },
  championSeed({
    id: "Ahri",
    name: "Ahri",
    title: "the Nine-Tailed Fox",
    lore: "Innately connected to the magic of the spirit realm, Ahri is a fox-like vastaya who can manipulate her prey's emotions and consume their essence—receiving flashes of their memory and insight from each soul she consumes. Once a powerful yet wayward predator, Ahri is now traveling the world in search of remnants of her ancestors while also trying to replace her stolen memories with ones of her own making.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Garen",
    name: "Garen",
    title: "The Might of Demacia",
    lore: "A proud and noble warrior, Garen fights as one of the Dauntless Vanguard. He is popular among his fellows, and respected well enough by his enemies—not least as a scion of the prestigious Crownguard family, entrusted with defending Demacia and its ideals. Clad in magic-resistant armor and bearing a mighty broadsword, Garen stands ready to confront mages and sorcerers on the field of battle, in a veritable whirlwind of righteous steel.",
    regionTags: ["Demacia"],
  }),
  championSeed({
    id: "Lux",
    name: "Lux",
    title: "the Lady of Luminosity",
    lore: "Luxanna Crownguard hails from Demacia, an insular realm where magical abilities are viewed with fear and suspicion. Able to bend light to her will, she grew up dreading discovery and exile, and was forced to keep her power secret, in order to preserve her family's noble status. Nonetheless, Lux's optimism and resilience have led her to embrace her unique talents, and she now covertly wields them in service of her homeland.",
    regionTags: ["Demacia"],
  }),
  championSeed({
    id: "Darius",
    name: "Darius",
    title: "the Hand of Noxus",
    lore: "There is no greater symbol of Noxian might than Darius, the nation's most feared and battle-hardened commander. Rising from humble origins to become the Hand of Noxus, he cleaves through the empire's enemies—many of them Noxians themselves. Knowing that he never doubts his cause is just, and never hesitates once his axe is raised, those who stand against the leader of the Trifarian Legion can expect no mercy.",
    regionTags: ["Noxus"],
  }),
  championSeed({
    id: "Jinx",
    name: "Jinx",
    title: "the Loose Cannon",
    lore: "An unhinged and impulsive criminal from the undercity, Jinx is haunted by the consequences of her past—but that doesn't stop her from bringing her own chaotic brand of pandemonium to Piltover and Zaun. She uses her arsenal of DIY weapons to devastating effect, unleashing torrents of colorful explosions and gunfire, inspiring the disenfranchised to rebellion and resistance with the mayhem she leaves in her wake.",
    regionTags: ["Zaun"],
  }),
  championSeed({
    id: "Yasuo",
    name: "Yasuo",
    title: "the Unforgiven",
    lore: "An Ionian of deep resolve, Yasuo is an agile swordsman who wields the air itself against his enemies. As a proud young man, he was falsely accused of murdering his master—unable to prove his innocence, he was forced to slay his own brother in self defense. Even after his master's true killer was revealed, Yasuo still could not forgive himself for all he had done, and now wanders his homeland with only the wind to guide his blade.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Thresh",
    name: "Thresh",
    title: "the Chain Warden",
    lore: "Sadistic and cunning, Thresh is an ambitious and restless specter of the Shadow Isles. Once the custodian of countless arcane secrets, he was undone by a power greater than life or death, and now sustains himself by tormenting and breaking others with slow, excruciating inventiveness. His victims suffer far beyond their brief mortal coil as Thresh wreaks agony upon their souls, imprisoning them in his unholy lantern to torture for all eternity.",
    regionTags: ["Shadow Isles"],
  }),
  championSeed({
    id: "Ashe",
    name: "Ashe",
    title: "the Frost Archer",
    lore: "Iceborn warmother of the Avarosan tribe, Ashe commands the most populous horde in the north. Stoic, intelligent, and idealistic, yet uncomfortable with her role as leader, she taps into the ancestral magics of her lineage to wield a bow of True Ice. With her people's belief that she is the mythological hero Avarosa reincarnated, Ashe hopes to unify the Freljord once more by retaking their ancient, tribal lands.",
    regionTags: ["Freljord"],
  }),
  championSeed({
    id: "LeeSin",
    name: "Lee Sin",
    title: "the Blind Monk",
    lore: "A master of Ionia's ancient martial arts, Lee Sin is a principled fighter who channels the essence of the dragon spirit to face any challenge. Though he lost his sight many years ago, the warrior-monk has devoted his life to protecting his homeland against any who would dare upset its sacred balance. Enemies who underestimate his meditative demeanor will endure his fabled burning fists and blazing roundhouse kicks.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Morgana",
    name: "Morgana",
    title: "the Fallen",
    lore: "Conflicted between her celestial and mortal natures, Morgana bound her wings to embrace humanity, and inflicts her pain and bitterness upon the dishonest and the corrupt. She rejects laws and traditions she believes are unjust, and fights for truth from the shadows of Demacia—even as others seek to repress it—by casting shields and chains of dark fire. More than anything else, Morgana truly believes that even the banished and outcast may one day rise again.",
    regionTags: ["Demacia"],
  }),
  {
    slug: "region-ionia",
    target_type: "region",
    canonical_title: "Ionia",
    protected_terms: ["Ionia", "Ionia's", "the land of Ionia"],
    accepted_solution_aliases: ["the land of ionia"],
    source_text:
      "Surrounded by treacherous seas, Ionia is composed of a number of allied provinces scattered across a massive archipelago, known to many as the First Lands. Since Ionian culture has long been shaped by the pursuit of balance in all things, the border between the material and spirit realms tends to be more permeable here, especially in the wild forests and mountains.Although these lands’ enchantments can be fickle, its creatures dangerous and fae, for many centuries most Ionians led lives of plenty. The warrior monasteries, provincial militias—and even Ionia itself—had been enough to protect them.But that ended twelve years ago, when Noxus attacked the First Lands. The empire’s seemingly endless warhosts savaged Ionia, and were only defeated after many years, and at great cost.Now, Ionia exists in an uneasy peace. Different reactions to the war have divided the region—some groups, such as the Shojin monks or the Kinkou, seek a return to isolationist pacifism, and pastoral traditions. Other more radical factions, such as the Navori Brotherhood and the Order of Shadow, demand a militarization of the land’s magic, to create a single, unified nation that can take vengeance on Noxus.The fate of Ionia hangs in a delicate balance that few are willing to overturn, but all can feel shifting uneasily beneath their feet.",
    source_url: "https://universe.leagueoflegends.com/en_US/region/ionia/",
    source_type: "official_page",
    locale: "en_US",
    difficulty: 2,
    region_tags: ["Ionia"],
    hint_metadata: {
      category_label: "region",
      region_label: "Ionia",
      period_label: "A timeless spiritual homeland",
    },
    review_status: "approved",
  },
  {
    slug: "region-demacia",
    target_type: "region",
    canonical_title: "Demacia",
    protected_terms: ["Demacia", "Demacia's"],
    accepted_solution_aliases: [],
    source_text:
      "A strong, lawful kingdom with a prestigious military history, Demacia’s people have always valued the ideals of justice, honor, and duty most highly, and are fiercely proud of their cultural heritage. But in spite of these lofty principles, this largely self-sufficient nation has grown more insular and isolationist in recent centuries.Now, Demacia is a kingdom in turmoil.The capital, the Great City of Demacia, was founded as a refuge from sorcery after the nightmare of the Rune Wars, and built upon the riddle of petricite—a peculiar white stone that dampens magical energy. It is from here that the royal family has long seen to the defense of the outlying towns and villages, farmland, forests, and mountains rich with mineral resources.However, following the sudden death of King Jarvan III, the other noble families have not yet approved the succession of his sole heir, young Prince Jarvan, to the throne.Those who dwell beyond the heavily guarded borders are increasingly viewed with suspicion, and many former allies have begun to look elsewhere for protection, in these uncertain times. Some dare to whisper that the golden age of Demacia has passed, and unless its people are willing to adapt to a changing world—something many believe they are simply incapable of doing—the kingdom’s decline may be inevitable.And all the petricite in the land will not protect Demacia from itself.",
    source_url: "https://universe.leagueoflegends.com/en_US/region/demacia/",
    source_type: "official_page",
    locale: "en_US",
    difficulty: 2,
    region_tags: ["Demacia"],
    hint_metadata: {
      category_label: "region",
      region_label: "Demacia",
      period_label: "A proud anti-magic kingdom",
    },
    review_status: "approved",
  },
];

/** @deprecated Use verifiedSeedManifest */
export const seedManifest = verifiedSeedManifest;
