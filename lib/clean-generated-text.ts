export const NO_DASH_WRITING_RULE = `Writing style rule:
Do not use em dashes, en dashes, or dash-separated clauses in visible text.
Never use: —, –, or spaced hyphens like " - " between clauses.
Avoid punctuation that feels like AI-generated prose.
Use natural sentence rhythm with commas and periods instead.
Rewrite sentences naturally instead of interrupting them with dashes.`;

export function cleanGeneratedText(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let cleaned = text
    .replace(/\s*—\s*/g, ". ")
    .replace(/\s*–\s*/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  cleaned = cleaned.replace(/\.{2,}/g, ".").replace(/\.\s+\./g, ".");

  return cleaned;
}
