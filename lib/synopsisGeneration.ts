import "server-only";

import { openai } from "@/lib/server/openai";
import { SYNOPSIS_MODEL } from "@/lib/server/generation-config";
import type { ApprovedSynopsis, BookFormInput } from "@/lib/types";
import { validateSynopsisPayload } from "@/lib/synopsisValidation";

export function getSynopsisModel() {
  return SYNOPSIS_MODEL;
}

function getResponseText(response: unknown) {
  const typed = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typed.output_text?.trim()) {
    return typed.output_text;
  }

  return (
    typed.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  );
}

function extractJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The synopsis model did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
}

export function buildSynopsisPrompt(input: BookFormInput, regenerationAttempt = 0) {
  const system = `You are a narrative designer specialized in Runeterra-inspired fantasy biographies.
You create short story synopses for original characters.
Your synopsis must be clear, cinematic, grounded in a region, and easy to understand.
You avoid vague prophecy, random symbolism, and disconnected fantasy clichés.
Return strict valid JSON only.`;

  const variationNote =
    regenerationAttempt > 0
      ? `\nThis is regeneration attempt ${regenerationAttempt}. Offer a meaningfully different angle: vary the role nuance, social position, emotional conflict, or champion connection while staying faithful to the user inputs.`
      : "";

  const user = `Create a short synopsis for a personalized fantasy biography.

User information:
Name: ${input.name}
Gender: ${input.gender}
Character type: ${input.characterType}
Selected region: ${input.runeterraRegion}

If the selected region is Auto, choose the most coherent region for the character type.

The synopsis must:
- be 90 to 140 words maximum
- describe the protagonist's role in the world
- describe their region and social position
- describe the emotional or moral conflict
- include a meaningful connection to one existing League of Legends champion
- remain canon-safe
- avoid spoilers for the full ending
- make the user want to generate the full book
- feel like the back-cover pitch of a fantasy lore book
- avoid page numbers, payment language, technical terms, and generic chosen-one phrasing

Champion connection rules:
- choose one champion fitting the region
- do not make the protagonist defeat, kill, marry, replace, or secretly belong to the champion's family
- do not invent major fake canon events
- the champion should influence the protagonist's story indirectly or through a believable connection
${variationNote}

Return JSON:
{
  "synopsis": "...",
  "legendaryTitle": "...",
  "region": "...",
  "specificRole": "...",
  "championConnection": {
    "championName": "...",
    "connectionSummary": "..."
  },
  "coreConflict": "..."
}`;

  return { system, user };
}

export async function generateSynopsis(input: BookFormInput, regenerationAttempt = 0): Promise<ApprovedSynopsis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const { system, user } = buildSynopsisPrompt(input, regenerationAttempt);
  const model = getSynopsisModel();

  console.log("[SYNOPSIS_TEXT_MODEL_USED]", SYNOPSIS_MODEL);

  const response = await openai.responses.create({
    model,
    instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
    input: `${user}\n\nReturn only one valid JSON object.`,
    text: {
      format: { type: "json_object" },
    },
    max_output_tokens: 700,
  });

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("The synopsis model returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch (error) {
    console.error("[SYNOPSIS_JSON_PARSE_ERROR]", error);
    throw new Error("The synopsis could not be read. Please try again.");
  }

  const synopsis = validateSynopsisPayload(parsed);
  if (!synopsis) {
    throw new Error("The synopsis was incomplete. Please try again.");
  }

  return synopsis;
}
