import type { ManualManifestEntry } from "@/lib/daily-mystery/importer/ddragon";

export const IRELIA_TEST_PASSAGE = `In the wake of the Noxian invasion, Irelia forged a new path for the people of Ionia. Swain's legions had carved through the province, yet Karma's teachings still echoed among the survivors. The Blade Dancer refused to let Noxus claim the spirit of her homeland.`;

export const seedManifest: ManualManifestEntry[] = [
  {
    slug: "champion-irelia-test",
    target_type: "champion",
    canonical_title: "Irelia",
    protected_terms: ["Irelia", "Irelia's", "Xan Irelia", "The Blade Dancer"],
    accepted_solution_aliases: ["the blade dancer", "xan irelia"],
    source_text: IRELIA_TEST_PASSAGE,
    source_url: "https://ddragon.leagueoflegends.com/cdn/manifest/irelia-test.json",
    source_type: "manual_manifest",
    difficulty: 3,
    region_tags: ["Ionia"],
    related_champion_ids: ["Irelia"],
    hint_metadata: {
      category_label: "champion",
      region_label: "Ionia",
      period_label: "After the Noxian invasion of Ionia",
      multiple_choice_options: ["Irelia", "Swain", "Karma", "Darius"],
    },
    review_status: "approved",
  },
  {
    slug: "region-ionia",
    target_type: "region",
    canonical_title: "Ionia",
    protected_terms: ["Ionia", "Ionia's", "the land of Ionia"],
    accepted_solution_aliases: ["the land of ionia"],
    source_text:
      "Ionia is a land of untold beauty and magic. Its people seek harmony with the spirit realm, yet the scars of invasion still mark its shores. Provinces rise and fall, but the soul of Ionia endures through every trial.",
    source_url: "https://universe.leagueoflegends.com/regions/ionia",
    source_type: "official_page",
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
    slug: "event-ruination",
    target_type: "event",
    canonical_title: "The Ruination",
    protected_terms: ["The Ruination", "Ruination", "the Ruination"],
    accepted_solution_aliases: ["ruination"],
    source_text:
      "When the Ruination swept across the Blessed Isles, kingdoms fell to darkness in a single night. Mist and sorrow replaced sunlight, and the living learned that even the proudest empire could be unmade by a single tragic choice.",
    source_url: "https://universe.leagueoflegends.com/events/ruination",
    source_type: "official_page",
    difficulty: 4,
    region_tags: ["Shadow Isles"],
    hint_metadata: {
      category_label: "historical event",
      region_label: "Shadow Isles",
      period_label: "The fall of the Blessed Isles",
    },
    review_status: "approved",
  },
];
