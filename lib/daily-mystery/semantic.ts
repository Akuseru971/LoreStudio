import "server-only";

import type { MysteryProximityLevel, MysteryPuzzleToken } from "@/lib/daily-mystery/types";
import {
  getCachedGuessEmbedding,
  getContentEmbeddings,
  saveCachedGuessEmbedding,
} from "@/lib/daily-mystery/store";
import { getOpenAIClient } from "@/lib/server/openai";
import { bucketFromSimilarity, cosineSimilarity } from "@/lib/daily-mystery/semantic-math";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export async function embedText(value: string) {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: value,
  });
  return response.data[0]?.embedding ?? [];
}

export async function getGuessEmbedding(normalizedGuess: string) {
  const cached = await getCachedGuessEmbedding(normalizedGuess);
  if (cached) {
    return cached;
  }

  try {
    const embedding = await embedText(normalizedGuess);
    if (embedding.length > 0) {
      await saveCachedGuessEmbedding(normalizedGuess, embedding);
    }
    return embedding;
  } catch (error) {
    console.warn("[MYSTERY_SEMANTIC_EMBED_FAILED]", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function computeSemanticProximity({
  contentItemId,
  guessLemma,
  tokens,
  revealed,
}: {
  contentItemId: string;
  guessLemma: string;
  tokens: MysteryPuzzleToken[];
  revealed: Set<string>;
}) {
  const guessEmbedding = await getGuessEmbedding(guessLemma);
  if (!guessEmbedding || guessEmbedding.length === 0) {
    return {} as Record<string, MysteryProximityLevel>;
  }

  const contentEmbeddings = await getContentEmbeddings(contentItemId);
  const updates: Record<string, MysteryProximityLevel> = {};

  for (const token of tokens) {
    if (token.type !== "word" || token.isProtected || revealed.has(token.id) || !token.lemma) {
      continue;
    }

    const tokenEmbedding = contentEmbeddings.get(token.lemma);
    if (!tokenEmbedding) {
      continue;
    }

    const similarity = cosineSimilarity(guessEmbedding, tokenEmbedding);
    const bucket = bucketFromSimilarity(similarity);
    if (bucket) {
      updates[token.id] = bucket;
    }
  }

  return updates;
}

export async function precomputeContentEmbeddings(contentItemId: string, lemmas: string[]) {
  const existing = await getContentEmbeddings(contentItemId);
  const missing = lemmas.filter((lemma) => !existing.has(lemma));
  if (missing.length === 0) {
    return;
  }

  const batch: Record<string, number[]> = {};
  for (const lemma of missing) {
    try {
      batch[lemma] = await embedText(lemma);
    } catch (error) {
      console.warn("[MYSTERY_CONTENT_EMBED_FAILED]", {
        contentItemId,
        lemma,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (Object.keys(batch).length > 0) {
    const { saveContentEmbeddings } = await import("@/lib/daily-mystery/store");
    await saveContentEmbeddings(contentItemId, batch);
  }
}

export { bucketFromSimilarity, cosineSimilarity } from "@/lib/daily-mystery/semantic-math";
