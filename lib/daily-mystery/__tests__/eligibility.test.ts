import { describe, expect, it } from "vitest";
import { verifiedSeedManifest } from "@/content/daily-mystery/seed-manifest";
import { isScheduleEligibleItem, filterScheduleEligibleItems } from "@/lib/daily-mystery/eligibility";
import { normalizeLocale, localesMatch } from "@/lib/daily-mystery/locale";
import { isOfficialChampionBiographyUrl } from "@/lib/daily-mystery/content-policy";

describe("locale normalization", () => {
  it("normalizes common locale aliases to en_US", () => {
    expect(normalizeLocale("en-US")).toBe("en_US");
    expect(normalizeLocale("english")).toBe("en_US");
    expect(localesMatch("en-us", "en_US")).toBe(true);
  });
});

describe("schedule eligibility", () => {
  it("allows approved, non-retired en_US content", () => {
    expect(
      isScheduleEligibleItem({ review_status: "approved", retired_at: null, locale: "en_US" }),
    ).toBe(true);
  });

  it("rejects draft, needs_review and retired content", () => {
    expect(
      isScheduleEligibleItem({ review_status: "draft", retired_at: null, locale: "en_US" }),
    ).toBe(false);
    expect(
      isScheduleEligibleItem({ review_status: "needs_review", retired_at: null, locale: "en_US" }),
    ).toBe(false);
    expect(
      isScheduleEligibleItem({ review_status: "approved", retired_at: "2026-01-01", locale: "en_US" }),
    ).toBe(false);
  });

  it("filters collections to eligible items only", () => {
    const eligible = filterScheduleEligibleItems([
      { review_status: "approved", retired_at: null, locale: "en_US", slug: "a" },
      { review_status: "draft", retired_at: null, locale: "en_US", slug: "b" },
    ]);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.slug).toBe("a");
  });
});

describe("verified seed manifest", () => {
  it("contains at least 10 official champion biography seed entries", () => {
    const champions = verifiedSeedManifest.filter((entry) => entry.target_type === "champion");
    expect(champions.length).toBeGreaterThanOrEqual(10);
  });

  it("marks every seed entry as approved with official sources", () => {
    for (const entry of verifiedSeedManifest) {
      expect(entry.review_status).toBe("approved");
      expect(entry.source_text.trim().length).toBeGreaterThan(20);
      expect(isOfficialChampionBiographyUrl(entry.source_url)).toBe(true);
      expect(entry.protected_terms.length).toBeGreaterThan(0);
    }
  });

  it("uses unique slugs for idempotent seeding", () => {
    const slugs = verifiedSeedManifest.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
