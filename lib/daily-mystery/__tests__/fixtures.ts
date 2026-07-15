import type { MysteryContentItem } from "@/lib/daily-mystery/types";

export const IRELIA_TEST_PASSAGE = `In the wake of the Noxian invasion, Irelia forged a new path for the people of Ionia. Swain's legions had carved through the province, yet Karma's teachings still echoed among the survivors. The Blade Dancer refused to let Noxus claim the spirit of her homeland.`;

export const IRELIA_PROTECTED_TERMS = ["Irelia", "Irelia's", "Xan Irelia", "The Blade Dancer"];

export const ireliaTestContent: MysteryContentItem = {
  id: "test-irelia",
  slug: "champion-irelia-test",
  locale: "en_US",
  target_type: "champion",
  canonical_title: "Irelia",
  protected_terms: IRELIA_PROTECTED_TERMS,
  accepted_solution_aliases: ["the blade dancer", "xan irelia"],
  source_text: IRELIA_TEST_PASSAGE,
  source_url: "https://www.leagueoflegends.com/en-us/champions/irelia/",
  source_domain: "leagueoflegends.com",
  source_type: "official_champion_biography",
  source_hash: "test-hash",
  riot_content_version: null,
  ddragon_version: null,
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
  imported_at: "2026-01-01T00:00:00.000Z",
  approved_at: "2026-01-01T00:00:00.000Z",
  retired_at: null,
};
