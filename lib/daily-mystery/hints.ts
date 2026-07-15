import type { MysteryContentItem, MysteryHintType, MysteryPuzzleToken } from "@/lib/daily-mystery/types";

const HINT_ORDER: MysteryHintType[] = ["category", "region", "period", "reveal_word", "multiple_choice"];

export function getNextHintType(usedHints: MysteryHintType[]) {
  return HINT_ORDER.find((hint) => !usedHints.includes(hint)) ?? null;
}

export function buildHintResponse({
  hintType,
  content,
  tokens,
  revealed,
}: {
  hintType: MysteryHintType;
  content: MysteryContentItem;
  tokens: MysteryPuzzleToken[];
  revealed: Set<string>;
}) {
  switch (hintType) {
    case "category":
      return {
        hintType,
        message: `The hidden subject is a ${content.hint_metadata.category_label || content.target_type.replace(/_/g, " ")}.`,
      };
    case "region":
      return {
        hintType,
        message: `This Chronicle is tied to ${content.hint_metadata.region_label || content.region_tags[0] || "an unknown region"}.`,
      };
    case "period":
      return {
        hintType,
        message:
          content.hint_metadata.period_label ||
          "The events unfold during a pivotal moment in Runeterra's history.",
      };
    case "reveal_word": {
      const candidate = tokens.find(
        (token) =>
          token.type === "word" &&
          !token.isProtected &&
          !revealed.has(token.id) &&
          Boolean(token.wordText),
      );
      if (!candidate?.id || !candidate.wordText) {
        return {
          hintType,
          message: "No additional clue could be drawn from the Chronicle.",
          revealedTokenIds: [] as string[],
          revealedTexts: {} as Record<string, string>,
        };
      }
      return {
        hintType,
        message: "A single unguarded word emerges from the fog.",
        revealedTokenIds: [candidate.id],
        revealedTexts: { [candidate.id]: candidate.wordText },
      };
    }
    case "multiple_choice": {
      const options =
        content.hint_metadata.multiple_choice_options?.length === 4
          ? content.hint_metadata.multiple_choice_options
          : buildDefaultMultipleChoice(content);
      return {
        hintType,
        message: "Four paths narrow the search.",
        options,
      };
    }
    default:
      return { hintType, message: "No more hints remain." };
  }
}

function buildDefaultMultipleChoice(content: MysteryContentItem) {
  const correct = content.canonical_title;
  const distractors = [
    "The Ruination",
    "Immortal Bastion",
    "Mount Targon",
    "The Void",
  ].filter((value) => value.toLowerCase() !== correct.toLowerCase());

  const options = [correct, ...distractors.slice(0, 3)];
  return shuffleDeterministic(options, content.id).slice(0, 4);
}

function shuffleDeterministic<T>(items: T[], seed: string) {
  const copy = [...items];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % copy.length;
    const swap = (hash + index) % copy.length;
    [copy[index % copy.length], copy[swap]] = [copy[swap]!, copy[index % copy.length]!];
  }
  return copy;
}

export function hintPenalty(hintsUsed: MysteryHintType[]) {
  return hintsUsed.length;
}
