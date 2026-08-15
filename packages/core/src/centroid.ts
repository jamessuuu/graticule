/** Note.centroid = the mean of a note's chunk embeddings (Decision 1: the
 * map, clustering, outlier detection and percentile all operate on note
 * centroids, never chunks directly). Pure, isomorphic — lives in `core`
 * because it's data-model math, not model-specific; the Worker computes it
 * right after embedding a note's chunks. */
export function centroid(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) return new Float32Array(0);
  const dim = embeddings[0]!.length;
  const out = new Float32Array(dim);
  for (const e of embeddings) {
    for (let d = 0; d < dim; d++) out[d] = (out[d] ?? 0) + e[d]! / embeddings.length;
  }
  return out;
}
