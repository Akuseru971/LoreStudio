const IRREGULAR_LEMMAS: Record<string, string> = {
  fought: "fight",
  fights: "fight",
  fighting: "fight",
  ran: "run",
  runs: "run",
  running: "run",
  was: "be",
  were: "be",
  been: "be",
  had: "have",
  has: "have",
  having: "have",
  went: "go",
  goes: "go",
  going: "go",
  said: "say",
  says: "say",
  saying: "say",
  took: "take",
  takes: "take",
  taking: "take",
  came: "come",
  comes: "come",
  coming: "come",
  saw: "see",
  sees: "see",
  seeing: "see",
  gave: "give",
  gives: "give",
  giving: "give",
  made: "make",
  makes: "make",
  making: "make",
  knew: "know",
  knows: "know",
  knowing: "know",
  thought: "think",
  thinks: "think",
  thinking: "think",
  found: "find",
  finds: "find",
  finding: "find",
  told: "tell",
  tells: "tell",
  telling: "tell",
  became: "become",
  becomes: "become",
  becoming: "become",
  left: "leave",
  leaves: "leave",
  leaving: "leave",
  felt: "feel",
  feels: "feel",
  feeling: "feel",
  brought: "bring",
  brings: "bring",
  bringing: "bring",
  began: "begin",
  begins: "begin",
  beginning: "begin",
  kept: "keep",
  keeps: "keep",
  keeping: "keep",
  held: "hold",
  holds: "hold",
  holding: "hold",
  wrote: "write",
  writes: "write",
  writing: "write",
  stood: "stand",
  stands: "stand",
  standing: "stand",
  heard: "hear",
  hears: "hear",
  hearing: "hear",
  let: "let",
  means: "mean",
  meant: "mean",
  set: "set",
  met: "meet",
  meets: "meet",
  meeting: "meet",
  led: "lead",
  leads: "lead",
  leading: "lead",
  won: "win",
  wins: "win",
  winning: "win",
  sent: "send",
  sends: "send",
  sending: "send",
  built: "build",
  builds: "build",
  building: "build",
  fell: "fall",
  falls: "fall",
  falling: "fall",
  cut: "cut",
  struck: "strike",
  strikes: "strike",
  striking: "strike",
  chose: "choose",
  chooses: "choose",
  choosing: "choose",
  drove: "drive",
  drives: "drive",
  driving: "drive",
  drew: "draw",
  draws: "draw",
  drawing: "draw",
  broke: "break",
  breaks: "break",
  breaking: "break",
  spoke: "speak",
  speaks: "speak",
  speaking: "speak",
  wore: "wear",
  wears: "wear",
  wearing: "wear",
  sought: "seek",
  seeks: "seek",
  seeking: "seek",
  taught: "teach",
  teaches: "teach",
  teaching: "teach",
  caught: "catch",
  catches: "catch",
  catching: "catch",
  bought: "buy",
  buys: "buy",
  buying: "buy",
  invasions: "invasion",
  invaded: "invasion",
  invading: "invasion",
  blades: "blade",
  dancers: "dancer",
};

export function normalizeGuessToken(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u2032`´]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function stripPossessive(normalized: string) {
  return normalized.replace(/['’]s$/i, "").replace(/['’]$/i, "");
}

export function lemmatizeEnglish(normalized: string) {
  const base = stripPossessive(normalized);
  if (!base) {
    return "";
  }

  if (IRREGULAR_LEMMAS[base]) {
    return IRREGULAR_LEMMAS[base];
  }

  if (base.endsWith("ies") && base.length > 4) {
    return `${base.slice(0, -3)}y`;
  }

  if (base.endsWith("ing") && base.length > 5) {
    const stem = base.slice(0, -3);
    if (stem.endsWith(stem.at(-1) || "")) {
      return stem.slice(0, -1);
    }
    return stem;
  }

  if (base.endsWith("ed") && base.length > 4) {
    const stem = base.slice(0, -2);
    if (stem.endsWith(stem.at(-1) || "")) {
      return stem.slice(0, -1);
    }
    return stem;
  }

  if (base.endsWith("es") && base.length > 4) {
    return base.slice(0, -2);
  }

  if (base.endsWith("s") && base.length > 3 && !base.endsWith("ss")) {
    return base.slice(0, -1);
  }

  return base;
}

export function tokenizeGuess(input: string) {
  const normalized = normalizeGuessToken(input);
  if (!normalized) {
    return { normalized: "", lemma: "", phraseParts: [] as string[] };
  }

  const phraseParts = normalized.split(" ").filter(Boolean);
  const lemma =
    phraseParts.length === 1 ? lemmatizeEnglish(phraseParts[0]!) : normalized.replace(/\s+/g, " ");

  return { normalized, lemma, phraseParts };
}

export function buildProtectedTermSet(terms: string[]) {
  const set = new Set<string>();
  for (const term of terms) {
    const normalized = normalizeGuessToken(term);
    if (!normalized) {
      continue;
    }
    set.add(normalized);
    set.add(stripPossessive(normalized));
    set.add(lemmatizeEnglish(normalized));
    for (const part of normalized.split(" ").filter(Boolean)) {
      set.add(part);
      set.add(lemmatizeEnglish(part));
    }
  }
  return set;
}

export function buildAcceptedAnswerSet(canonicalTitle: string, aliases: string[]) {
  const terms = new Set<string>();
  for (const value of [canonicalTitle, ...aliases]) {
    const normalized = normalizeGuessToken(value);
    if (!normalized) {
      continue;
    }
    terms.add(normalized);
    terms.add(stripPossessive(normalized));
  }
  return terms;
}

/** @deprecated Use buildAcceptedAnswerSet */
export function buildSolutionAliasSet(
  canonicalTitle: string,
  aliases: string[],
  _protectedTerms?: string[],
) {
  return buildAcceptedAnswerSet(canonicalTitle, aliases);
}

export function isSolutionGuess(
  guessNormalized: string,
  canonicalTitle: string,
  aliases: string[],
) {
  const acceptedAnswers = buildAcceptedAnswerSet(canonicalTitle, aliases);
  const stripped = stripPossessive(guessNormalized);
  return acceptedAnswers.has(guessNormalized) || acceptedAnswers.has(stripped);
}
