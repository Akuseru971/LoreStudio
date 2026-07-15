const LOCALE_ALIASES: Record<string, string> = {
  en_us: "en_US",
  "en-us": "en_US",
  english: "en_US",
  en: "en_US",
};

export function normalizeLocale(locale: string | null | undefined) {
  const raw = (locale ?? "en_US").trim();
  if (!raw) {
    return "en_US";
  }
  const lowered = raw.toLowerCase().replace(/-/g, "_");
  return LOCALE_ALIASES[lowered] ?? raw;
}

export function localesMatch(a: string | null | undefined, b: string | null | undefined) {
  return normalizeLocale(a) === normalizeLocale(b);
}
