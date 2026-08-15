import { describe, expect, it } from "vitest";
import { rankBySimilarity } from "../src/rank.js";

function vec(...xs: number[]): Float32Array {
  return new Float32Array(xs);
}

describe("rankBySimilarity", () => {
  it("ranks the most similar item first", () => {
    const query = vec(1, 0, 0);
    const corpus = [
      { id: "far", embedding: vec(0, 1, 0) },
      { id: "near", embedding: vec(0.99, 0.01, 0) },
      { id: "mid", embedding: vec(0.5, 0.5, 0) },
    ];
    const ranked = rankBySimilarity(query, corpus);
    expect(ranked.map((r) => r.id)).toEqual(["near", "mid", "far"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("never exposes a similarity score, only id and rank", () => {
    const ranked = rankBySimilarity(vec(1, 0), [{ id: "a", embedding: vec(1, 0) }]);
    expect(Object.keys(ranked[0]!).sort()).toEqual(["id", "rank"]);
  });

  it("breaks exact ties deterministically by id", () => {
    const query = vec(1, 0);
    const corpus = [
      { id: "b", embedding: vec(1, 0) },
      { id: "a", embedding: vec(1, 0) },
    ];
    const ranked = rankBySimilarity(query, corpus);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("handles an empty corpus", () => {
    expect(rankBySimilarity(vec(1, 0), [])).toEqual([]);
  });
});
