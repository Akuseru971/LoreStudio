import { describe, expect, it } from "vitest";
import { buildOfficialChampionPageUrl, isOfficialChampionBiographyUrl, parseOfficialChampionSlug } from "@/lib/daily-mystery/content-policy";
import { extractOfficialChampionBiography } from "@/lib/daily-mystery/importer/official-champion-page-parser";

describe("official champion page importer", () => {
  it("accepts only strict leagueoflegends.com champion biography URLs", () => {
    expect(isOfficialChampionBiographyUrl(buildOfficialChampionPageUrl("ahri"))).toBe(true);
    expect(parseOfficialChampionSlug("https://www.leagueoflegends.com/en-us/champions/ahri/")).toBe("ahri");
    expect(isOfficialChampionBiographyUrl("https://ddragon.leagueoflegends.com/cdn/data/champion/Ahri.json")).toBe(
      false,
    );
    expect(isOfficialChampionBiographyUrl("https://www.leagueoflegends.com/en-gb/champions/ahri/")).toBe(false);
  });

  it("extracts biography text from a character masthead blade", () => {
    const extracted = extractOfficialChampionBiography({
      title: "Ahri",
      blades: [
        {
          type: "characterMasthead",
          title: "Ahri",
          subtitle: "the Nine-Tailed Fox",
          description: {
            body: "Innately connected to the magic of the spirit realm, Ahri is a fox-like vastaya.",
          },
        },
      ],
    });

    expect(extracted?.canonicalTitle).toBe("Ahri");
    expect(extracted?.subtitle).toBe("the Nine-Tailed Fox");
    expect(extracted?.sourceText).toContain("spirit realm");
  });
});
