import { describe, expect, it } from "vitest";
import { bucketFromSimilarity, cosineSimilarity } from "@/lib/daily-mystery/semantic-math";
import { mergeProximity } from "@/lib/daily-mystery/match";

describe("semantic proximity bucketing", () => {
  it("buckets cosine similarity into proximity levels", () => {
    expect(bucketFromSimilarity(0.9)).toBe("very_close");
    expect(bucketFromSimilarity(0.75)).toBe("warm");
    expect(bucketFromSimilarity(0.6)).toBe("close");
    expect(bucketFromSimilarity(0.2)).toBeNull();
  });

  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("mergeProximity", () => {
  it("preserves the highest proximity reached", () => {
    const merged = mergeProximity(
      { t1: "close" },
      { t1: "warm", t2: "very_close" },
    );
    expect(merged.t1).toBe("warm");
    expect(merged.t2).toBe("very_close");
  });
});
