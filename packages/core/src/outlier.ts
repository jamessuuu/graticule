/**
 * Outlier detection. SPEC.md §5: shown at n >= 3; "lowest mean cosine
 * similarity to every other centroid, in full embedding space, never read
 * off the 2D map." Copy: "Uses different wording than the rest."
 */
import { cosineSimilarity } from "./similarity.js";
import type { CentroidItem } from "./pairs.js";

const MIN_NOTES = 3;

export interface OutlierResult {
  id: string;
  meanSimilarity: number;
}

export function outlierNote(centroids: CentroidItem[]): OutlierResult | null {
  if (centroids.length < MIN_NOTES) return null;

  let worstId: string | null = null;
  let worstMean = Number.POSITIVE_INFINITY;

  for (let i = 0; i < centroids.length; i++) {
    let sum = 0;
    for (let j = 0; j < centroids.length; j++) {
      if (i === j) continue;
      sum += cosineSimilarity(centroids[i]!.embedding, centroids[j]!.embedding);
    }
    const mean = sum / (centroids.length - 1);
    if (mean < worstMean || (mean === worstMean && (worstId === null || centroids[i]!.id < worstId))) {
      worstMean = mean;
      worstId = centroids[i]!.id;
    }
  }

  return worstId === null ? null : { id: worstId, meanSimilarity: worstMean };
}
