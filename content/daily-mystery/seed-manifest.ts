import type { ManualManifestEntry } from "@/lib/daily-mystery/importer/ddragon";
import { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";
import { buildOfficialChampionPageUrl } from "@/lib/daily-mystery/content-policy";

function championSeed({
  id,
  pageSlug,
  name,
  title,
  lore,
  regionTags,
  difficulty = 3,
  aliases = [],
}: {
  id: string;
  pageSlug: string;
  name: string;
  title: string;
  lore: string;
  regionTags: string[];
  difficulty?: number;
  aliases?: string[];
}): ManualManifestEntry {
  const slug = `champion-${pageSlug}`;
  const sourceUrl = buildOfficialChampionPageUrl(pageSlug);
  return {
    slug,
    target_type: "champion",
    canonical_title: name,
    protected_terms: buildChampionProtectedTerms(name, [title, ...aliases]),
    accepted_solution_aliases: [title.toLowerCase(), ...aliases.map((alias) => alias.toLowerCase())],
    source_text: lore,
    source_url: sourceUrl,
    source_type: "official_champion_biography",
    locale: "en_US",
    difficulty,
    region_tags: regionTags,
    related_champion_ids: [id],
    hint_metadata: {
      category_label: "champion",
      region_label: regionTags[0],
      period_label: "A defining chapter in Runeterra's history.",
    },
    review_status: "approved",
  };
}

export const verifiedSeedManifest: ManualManifestEntry[] = [
  championSeed({
    id: "Ahri",
    pageSlug: "ahri",
    name: "Ahri",
    title: "the Nine-Tailed Fox",
    lore: "Innately connected to the magic of the spirit realm, Ahri is a fox-like vastaya who can manipulate her prey's emotions and consume their essence—receiving flashes of their memory and insight from each soul she consumes. Once a powerful yet wayward predator, Ahri is now traveling the world in search of remnants of her ancestors while also trying to replace her stolen memories with ones of her own making.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Garen",
    pageSlug: "garen",
    name: "Garen",
    title: "The Might of Demacia",
    lore: "A proud and noble warrior, Garen fights as one of the Dauntless Vanguard. He is popular among his fellows, and respected well enough by his enemies—not least as a scion of the prestigious Crownguard family, entrusted with defending Demacia and its ideals. Clad in magic-resistant armor and bearing a mighty broadsword, Garen stands ready to confront mages and sorcerers on the field of battle, in a veritable whirlwind of righteous steel.",
    regionTags: ["Demacia"],
  }),
  championSeed({
    id: "Lux",
    pageSlug: "lux",
    name: "Lux",
    title: "the Lady of Luminosity",
    lore: "Luxanna Crownguard hails from Demacia, an insular realm where magical abilities are viewed with fear and suspicion. Able to bend light to her will, she grew up dreading discovery and exile, and was forced to keep her power secret, in order to preserve her family's noble status. Nonetheless, Lux's optimism and resilience have led her to embrace her unique talents, and she now covertly wields them in service of her homeland.",
    regionTags: ["Demacia"],
  }),
  championSeed({
    id: "Darius",
    pageSlug: "darius",
    name: "Darius",
    title: "the Hand of Noxus",
    lore: "There is no greater symbol of Noxian might than Darius, the nation's most feared and battle-hardened commander. Rising from humble origins to become the Hand of Noxus, he cleaves through the empire's enemies—many of them Noxians themselves. Knowing that he never doubts his cause is just, and never hesitates once his axe is raised, those who stand against the leader of the Trifarian Legion can expect no mercy.",
    regionTags: ["Noxus"],
  }),
  championSeed({
    id: "Jinx",
    pageSlug: "jinx",
    name: "Jinx",
    title: "the Loose Cannon",
    lore: "An unhinged and impulsive criminal from the undercity, Jinx is haunted by the consequences of her past—but that doesn't stop her from bringing her own chaotic brand of pandemonium to Piltover and Zaun. She uses her arsenal of DIY weapons to devastating effect, unleashing torrents of colorful explosions and gunfire, inspiring the disenfranchised to rebellion and resistance with the mayhem she leaves in her wake.",
    regionTags: ["Zaun"],
  }),
  championSeed({
    id: "Yasuo",
    pageSlug: "yasuo",
    name: "Yasuo",
    title: "the Unforgiven",
    lore: "An Ionian of deep resolve, Yasuo is an agile swordsman who wields the air itself against his enemies. As a proud young man, he was falsely accused of murdering his master—unable to prove his innocence, he was forced to slay his own brother in self defense. Even after his master's true killer was revealed, Yasuo still could not forgive himself for all he had done, and now wanders his homeland with only the wind to guide his blade.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Thresh",
    pageSlug: "thresh",
    name: "Thresh",
    title: "the Chain Warden",
    lore: "Sadistic and cunning, Thresh is an ambitious and restless specter of the Shadow Isles. Once the custodian of countless arcane secrets, he was undone by a power greater than life or death, and now sustains himself by tormenting and breaking others with slow, excruciating inventiveness. His victims suffer far beyond their brief mortal coil as Thresh wreaks agony upon their souls, imprisoning them in his unholy lantern to torture for all eternity.",
    regionTags: ["Shadow Isles"],
  }),
  championSeed({
    id: "Ashe",
    pageSlug: "ashe",
    name: "Ashe",
    title: "the Frost Archer",
    lore: "Iceborn warmother of the Avarosan tribe, Ashe commands the most populous horde in the north. Stoic, intelligent, and idealistic, yet uncomfortable with her role as leader, she taps into the ancestral magics of her lineage to wield a bow of True Ice. With her people's belief that she is the mythological hero Avarosa reincarnated, Ashe hopes to unify the Freljord once more by retaking their ancient, tribal lands.",
    regionTags: ["Freljord"],
  }),
  championSeed({
    id: "LeeSin",
    pageSlug: "leesin",
    name: "Lee Sin",
    title: "the Blind Monk",
    lore: "A master of Ionia's ancient martial arts, Lee Sin is a principled fighter who channels the essence of the dragon spirit to face any challenge. Though he lost his sight many years ago, the warrior-monk has devoted his life to protecting his homeland against any who would dare upset its sacred balance. Enemies who underestimate his meditative demeanor will endure his fabled burning fists and blazing roundhouse kicks.",
    regionTags: ["Ionia"],
  }),
  championSeed({
    id: "Morgana",
    pageSlug: "morgana",
    name: "Morgana",
    title: "the Fallen",
    lore: "Conflicted between her celestial and mortal natures, Morgana bound her wings to embrace humanity, and inflicts her pain and bitterness upon the dishonest and the corrupt. She rejects laws and traditions she believes are unjust, and fights for truth from the shadows of Demacia—even as others seek to repress it—by casting shields and chains of dark fire. More than anything else, Morgana truly believes that even the banished and outcast may one day rise again.",
    regionTags: ["Demacia"],
  }),
];

/** @deprecated Use verifiedSeedManifest */
export const seedManifest = verifiedSeedManifest;
