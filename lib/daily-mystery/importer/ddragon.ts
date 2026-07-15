import "server-only";

import { createHash } from "crypto";
import type { MysteryContentItem, MysterySourceType, MysteryTargetType } from "@/lib/daily-mystery/types";

export type ManualManifestEntry = {
  slug: string;
  target_type: MysteryTargetType;
  canonical_title: string;
  protected_terms: string[];
  accepted_solution_aliases?: string[];
  source_text: string;
  source_url: string;
  source_type: MysterySourceType;
  locale?: string;
  difficulty?: number;
  region_tags?: string[];
  related_champion_ids?: string[];
  hint_metadata?: MysteryContentItem["hint_metadata"];
  review_status?: MysteryContentItem["review_status"];
  riot_content_version?: string | null;
  ddragon_version?: string | null;
};

export function hashImportPayload(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export { buildChampionProtectedTerms } from "@/lib/daily-mystery/champion-terms";
export {
  importChampionFromOfficialPage,
  importOfficialChampionCatalog,
} from "@/lib/daily-mystery/importer/official-champion-page";
