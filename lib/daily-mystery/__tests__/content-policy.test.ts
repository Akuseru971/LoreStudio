import { describe, expect, it } from "vitest";
import { verifiedSeedManifest } from "@/content/daily-mystery/seed-manifest";
import {
  buildOfficialChampionPageUrl,
  classifyDisallowedDailyMysterySource,
  isDailyMysterySchedulable,
  isDailyMysterySeedEntry,
  isOfficialChampionBiographyUrl,
} from "@/lib/daily-mystery/content-policy";
import { hashSourceText } from "@/lib/daily-mystery/tokenize";

describe("daily mystery content policy", () => {
  it("accepts official English champion biography pages from leagueoflegends.com", () => {
    const champion = verifiedSeedManifest.find((entry) => entry.slug === "champion-ahri");
    expect(champion).toBeDefined();
    expect(isOfficialChampionBiographyUrl(champion!.source_url)).toBe(true);
    expect(isDailyMysterySeedEntry(champion!)).toBe(true);
    expect(
      isDailyMysterySchedulable({
        ...champion!,
        source_hash: hashSourceText(champion!.source_text),
        review_status: "approved",
        retired_at: null,
      }),
    ).toBe(true);
  });

  it("rejects Data Dragon, universe, and non-champion sources", () => {
    expect(
      isDailyMysterySchedulable({
        review_status: "approved",
        retired_at: null,
        locale: "en_US",
        target_type: "champion",
        source_type: "full_biography",
        source_url: "https://ddragon.leagueoflegends.com/cdn/16.14.1/data/en_US/champion/Ahri.json",
        source_text: "Innately connected to the magic of the spirit realm.",
        source_hash: hashSourceText("Innately connected to the magic of the spirit realm."),
        hint_metadata: {},
      }),
    ).toBe(false);

    expect(
      classifyDisallowedDailyMysterySource({
        target_type: "region",
        source_type: "official_page",
        source_url: "https://universe.leagueoflegends.com/en_US/region/ionia/",
        locale: "en_US",
      }),
    ).toBe("non_champion");

    expect(isOfficialChampionBiographyUrl("https://universe.leagueoflegends.com/en_US/region/ionia/")).toBe(
      false,
    );
  });

  it("requires every verified seed entry to pass official champion page validation", () => {
    for (const entry of verifiedSeedManifest) {
      expect(entry.target_type).toBe("champion");
      expect(entry.source_type).toBe("official_champion_biography");
      expect(isDailyMysterySeedEntry(entry)).toBe(true);
      expect(entry.source_url).toBe(buildOfficialChampionPageUrl(entry.source_url.split("/").at(-2)!));
    }

    expect(verifiedSeedManifest.length).toBeGreaterThanOrEqual(10);
  });
});
