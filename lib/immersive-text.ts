const IMMERSION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bchoices made on page \d+\b/gi, "choices made that night"],
  [/\bthe name on page \d+\b/gi, "the name he had heard in the tunnels"],
  [/\bon page \d+\b/gi, ""],
  [/\bfrom page \d+\b/gi, ""],
  [/\bto page \d+\b/gi, ""],
  [/\bpage \d+\b/gi, ""],
  [/\bthis page\b/gi, "this moment"],
  [/\bthe previous page\b/gi, "what came before"],
  [/\bthe next page\b/gi, "what followed"],
  [/\bthis biography\b/gi, "this life"],
  [/\bthe biography\b/gi, "the chronicle"],
  [/\bhis biography\b/gi, "his life"],
  [/\bher biography\b/gi, "her life"],
  [/\btheir biography\b/gi, "their life"],
  [/\bstory structure\b/gi, ""],
  [/\bnarrative structure\b/gi, ""],
  [/\bpaid section\b/gi, ""],
  [/\bpaid continuation\b/gi, ""],
  [/\bthe reader\b/gi, ""],
  [/\bthe user\b/gi, ""],
  [/\bgenerated story\b/gi, ""],
  [/\bthe prompt\b/gi, ""],
  [/\bas the biography continues\b/gi, "as the years went on"],
  [/\bthis chapter shows\b/gi, ""],
  [/\bthe story now reveals\b/gi, ""],
  [/\bthe trial began\b/gi, "the hearing began"],
  [/\bthe pattern broke\b/gi, "the plan failed"],
  [/\bthe pattern shifted\b/gi, "the route changed"],
  [/\bfate shifted\b/gi, "fortune turned"],
  [/\bthe omen arrived\b/gi, "the warning came"],
  [/\bthe shadow answered\b/gi, "the danger followed"],
  [/\bthe silence remembered\b/gi, "the silence held"],
  [/\bdestiny called\b/gi, "duty called"],
];

const IMMERSION_BANNED_PATTERN =
  /\b(page\s*\d+|previous page|next page|this page|biography|paywall|unlock|paid section|reader|generated|prompt|continuation|story structure|narrative structure|chapter mechanics)\b/i;

export function containsImmersiveBreak(text: string) {
  return IMMERSION_BANNED_PATTERN.test(text);
}

export function polishImmersiveStoryText(text: string, maxLength = 700) {
  let polished = text.replace(/\s+/g, " ").trim();

  for (const [pattern, replacement] of IMMERSION_REPLACEMENTS) {
    polished = polished.replace(pattern, replacement);
  }

  polished = polished
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  if (polished.length > maxLength) {
    polished = polished.slice(0, maxLength).trim();
  }

  return polished;
}
