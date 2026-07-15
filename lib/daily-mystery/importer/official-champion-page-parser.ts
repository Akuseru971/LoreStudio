type CharacterMastheadBlade = {
  type?: string;
  title?: string;
  subtitle?: string;
  description?: {
    body?: string;
  };
};

export type OfficialChampionPage = {
  id?: string;
  title?: string;
  blades?: CharacterMastheadBlade[];
};

export function parseOfficialChampionNextData(html: string) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Unable to parse official champion page payload.");
  }
  return JSON.parse(match[1]!) as {
    props?: { pageProps?: { page?: OfficialChampionPage } };
  };
}

export function extractOfficialChampionBiography(page: OfficialChampionPage) {
  const masthead = page.blades?.find((blade) => blade.type === "characterMasthead");
  const sourceText = masthead?.description?.body?.trim();
  const canonicalTitle = masthead?.title?.trim() || page.title?.trim();
  const subtitle = masthead?.subtitle?.trim() || "";

  if (!sourceText || !canonicalTitle) {
    return null;
  }

  return {
    canonicalTitle,
    subtitle,
    sourceText,
  };
}

export function championKeyFromPage(page: OfficialChampionPage, slug: string) {
  const pageId = page.id?.split(".")[1];
  if (!pageId) {
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  if (pageId === "leesin") {
    return "LeeSin";
  }
  if (pageId === "chogath") {
    return "Chogath";
  }
  if (pageId === "belveth") {
    return "Belveth";
  }
  return pageId.charAt(0).toUpperCase() + pageId.slice(1);
}
