import { describe, expect, it } from "vitest";
import {
  buildOfficialChampionPageUrl,
  isDailyMysterySchedulable,
} from "@/lib/daily-mystery/content-policy";
import { getValidatedVictorySource, isDailyMysteryContentServable } from "@/lib/daily-mystery/content-serving";
import { hashSourceText } from "@/lib/daily-mystery/tokenize";
import type { MysteryContentItem } from "@/lib/daily-mystery/types";

const MORGANA_OFFICIAL_BIO =
  "Conflicted between her celestial and mortal natures, Morgana bound her wings to embrace humanity, and inflicts her pain and bitterness upon the dishonest and the corrupt. She rejects laws and traditions she believes are unjust, and fights for truth from the shadows of Demacia—even as others seek to repress it—by casting shields and chains of dark fire. More than anything else, Morgana truly believes that even the banished and outcast may one day rise again.";

function buildMorganaRecord(
  overrides: Partial<MysteryContentItem>,
): MysteryContentItem {
  const sourceText = overrides.source_text ?? MORGANA_OFFICIAL_BIO;
  return {
    id: overrides.id ?? "morgana-id",
    slug: overrides.slug ?? "champion-morgana",
    locale: "en_US",
    target_type: "champion",
    canonical_title: "Morgana",
    protected_terms: ["Morgana", "Morgana's", "the Fallen"],
    accepted_solution_aliases: ["the fallen"],
    source_text: sourceText,
    source_url: overrides.source_url ?? buildOfficialChampionPageUrl("morgana"),
    source_domain: overrides.source_domain ?? "www.leagueoflegends.com",
    source_type: overrides.source_type ?? "official_champion_biography",
    source_hash: overrides.source_hash ?? hashSourceText(sourceText),
    riot_content_version: null,
    ddragon_version: overrides.ddragon_version ?? null,
    difficulty: 3,
    region_tags: ["Demacia"],
    related_champion_ids: ["Morgana"],
    hint_metadata: {},
    review_status: overrides.review_status ?? "approved",
    imported_at: "2026-01-01T00:00:00.000Z",
    approved_at: "2026-01-01T00:00:00.000Z",
    retired_at: overrides.retired_at ?? null,
  };
}

describe("morgana official source regression", () => {
  it("rejects DDragon Morgana records for scheduling and victory source display", () => {
    const ddragonMorgana = buildMorganaRecord({
      source_url: "https://ddragon.leagueoflegends.com/cdn/16.14.1/data/en_US/champion/Morgana.json",
      source_type: "full_biography",
      source_domain: "ddragon.leagueoflegends.com",
      ddragon_version: "16.14.1",
    });

    expect(isDailyMysterySchedulable(ddragonMorgana)).toBe(false);
    expect(isDailyMysteryContentServable(ddragonMorgana)).toBe(false);
    expect(getValidatedVictorySource(ddragonMorgana)).toEqual({
      sourceUrl: "",
      sourceDomain: "",
    });
  });

  it("accepts official Morgana biography records for scheduling and victory source display", () => {
    const officialMorgana = buildMorganaRecord({});

    expect(isDailyMysterySchedulable(officialMorgana)).toBe(true);
    expect(isDailyMysteryContentServable(officialMorgana)).toBe(true);
    expect(getValidatedVictorySource(officialMorgana)).toEqual({
      sourceUrl: "https://www.leagueoflegends.com/en-us/champions/morgana/",
      sourceDomain: "www.leagueoflegends.com",
    });
  });
});
