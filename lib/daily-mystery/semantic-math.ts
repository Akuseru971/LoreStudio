import type { MysteryProximityLevel } from "@/lib/daily-mystery/types";
import { SEMANTIC_THRESHOLDS } from "@/lib/daily-mystery/types";

export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += a[index]! * b[index]!;
    normA += a[index]! * a[index]!;
    normB += b[index]! * b[index]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function bucketFromSimilarity(similarity: number): MysteryProximityLevel {
  if (similarity >= SEMANTIC_THRESHOLDS.very_close) {
    return "very_close";
  }
  if (similarity >= SEMANTIC_THRESHOLDS.warm) {
    return "warm";
  }
  if (similarity >= SEMANTIC_THRESHOLDS.close) {
    return "close";
  }
  return null;
}
