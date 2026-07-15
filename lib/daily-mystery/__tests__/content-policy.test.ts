import { describe, expect, it } from "vitest";
import { verifiedSeedManifest } from "@/content/daily-mystery/seed-manifest";
import {
  isChampionBiographyContent,
  isDailyMysterySchedulable,
  isDailyMysterySeedEntry,
  isOfficialLocationContent,
} from "@/lib/daily-mystery/content-policy";

describe("daily mystery content policy", () => {
  it("accepts official English champion biographies from Data Dragon", () => {
    const champion = verifiedSeedManifest.find((entry) => entry.slug === "champion-ahri");
    expect(champion).toBeDefined();
    expect(isChampionBiographyContent(champion!)).toBe(true);
    expect(isDailyMysterySchedulable({ ...champion!, review_status: "approved", retired_at: null })).toBe(true);
  });

  it("accepts official English location pages from Universe", () => {
    const region = verifiedSeedManifest.find((entry) => entry.slug === "region-ionia");
    expect(region).toBeDefined();
    expect(isOfficialLocationContent(region!)).toBe(true);
    expect(isDailyMysterySchedulable({ ...region!, review_status: "approved", retired_at: null })).toBe(true);
  });

  it("rejects events, blurbs, and non-official categories", () => {
    expect(
      isDailyMysterySchedulable({
        review_status: "approved",
        retired_at: null,
        locale: "en_US",
        target_type: "event",
        source_type: "official_page",
        source_url: "https://universe.leagueoflegends.com/en_US/events/ruination/",
        source_text: "When the Ruination swept across the Blessed Isles.",
      }),
    ).toBe(false);

    expect(
      isDailyMysterySchedulable({
        review_status: "approved",
        retired_at: null,
        locale: "en_US",
        target_type: "region",
        source_type: "official_blurb",
        source_url: "https://universe.leagueoflegends.com/en_US/region/demacia/",
        source_text: "A strong, lawful kingdom with a prestigious military history.",
      }),
    ).toBe(false);
  });

  it("requires every verified seed entry to pass seed validation", () => {
    for (const entry of verifiedSeedManifest) {
      expect(isDailyMysterySeedEntry(entry)).toBe(true);
    }

    const champions = verifiedSeedManifest.filter((entry) => entry.target_type === "champion");
    const locations = verifiedSeedManifest.filter((entry) => entry.target_type === "region" || entry.target_type === "place");
    const events = verifiedSeedManifest.filter((entry) => entry.target_type === "event");

    expect(champions.length).toBeGreaterThanOrEqual(10);
    expect(locations.length).toBeGreaterThanOrEqual(2);
    expect(events).toHaveLength(0);
  });
});
