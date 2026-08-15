/** Shared cosine similarity helper. Internal only — never exported as a
 * bare number to a UI surface (Decision 5); consumers of this module are
 * themselves the sanctioned exception (rank/percentile/cluster/outlier all
 * consume the *comparison*, not the raw float, except §6's one labelled
 * exception which lives in the model layer / NegationDemo component). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
