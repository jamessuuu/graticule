/**
 * Pairwise percentile. SPEC.md §5: "a within-session percentile against
 * the visitor's own set, shown only at n >= 5 notes (10 pairs) — a
 * percentile over 3 pairs is false precision." Copy: "more similar than
 * N% of the other pairs you pasted."
 */
const MIN_PAIRS = 10;

/** Percentile rank of `pair` within `allPairs` (0-100), or `null` below
 * the 10-pair floor. Midpoint ("mean") rank handling for ties: a pair
 * exactly tied with others counts as beating half of its ties, matching
 * the plain-English "more similar than N% of the others" framing without
 * inflating N when many pairs share a similarity value. */
export function percentile(pair: number, allPairs: number[]): number | null {
  if (allPairs.length < MIN_PAIRS) return null;

  let below = 0;
  let equal = 0;
  for (const p of allPairs) {
    if (p < pair) below++;
    else if (p === pair) equal++;
  }
  const total = allPairs.length;
  return ((below + 0.5 * equal) / total) * 100;
}
