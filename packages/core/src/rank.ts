/**
 * Search ranking. SPEC.md §5: "an ordered list, no score." Callers must
 * never surface a similarity number here — only `rank` is returned.
 */
import { cosineSimilarity } from "./similarity.js";

export interface RankedResult {
  id: string;
  rank: number;
}

export interface RankableItem {
  id: string;
  embedding: Float32Array;
}

/** Ranks `corpus` by cosine similarity to `query`, descending. Ties break
 * on id (lexicographic) so output is fully deterministic. No similarity
 * value is returned — only rank — per Decision 5. */
export function rankBySimilarity(query: Float32Array, corpus: RankableItem[]): RankedResult[] {
  const scored = corpus.map((item) => ({
    id: item.id,
    score: cosineSimilarity(query, item.embedding),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return scored.map((s, i) => ({ id: s.id, rank: i + 1 }));
}
