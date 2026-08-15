/** All pairwise cosine similarities across a set of note centroids — the
 * population `percentile()` and `outlierNote()` are computed against.
 * SPEC.md §5: pairwise/percentile and outlier operate on note centroids,
 * never chunks (Decision 1). */
import { cosineSimilarity } from "./similarity.js";

export interface CentroidItem {
  id: string;
  embedding: Float32Array;
}

export interface PairSimilarity {
  a: string;
  b: string;
  similarity: number;
}

/** All C(n,2) unordered pairs, in a stable order (by input index) so
 * output is deterministic across runs for the same centroid set. */
export function allPairwiseSimilarities(centroids: CentroidItem[]): PairSimilarity[] {
  const out: PairSimilarity[] = [];
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      out.push({
        a: centroids[i]!.id,
        b: centroids[j]!.id,
        similarity: cosineSimilarity(centroids[i]!.embedding, centroids[j]!.embedding),
      });
    }
  }
  return out;
}
