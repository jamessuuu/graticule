/**
 * Deterministic clustering. SPEC.md §5 Decision 4: "agglomerative,
 * average-linkage cosine over full-dimension centroids, fixed cut
 * threshold tuned against min-cluster-n. k-means is rejected because
 * random init would make the same paste produce different groups on
 * different runs." Shown only at n >= 15 (§5, the floor linguistic-spec
 * §1c names as where assignment stops being dominated by two or three
 * nearest points).
 *
 * Standard UPGMA (average-linkage) via the Lance-Williams update, so a
 * merge's distance to every remaining cluster is updated in O(1) instead
 * of re-averaging raw member lists — O(n^2) space, O(n^3) worst-case time
 * (linear scan for the minimum each of the ~n merge steps), which is fine
 * at the product's n <= 200 note cap.
 */
import { cosineSimilarity } from "./similarity";
import type { CentroidItem } from "./pairs";
import type { Cluster } from "./types";

const MIN_NOTES = 15;

/** Cosine-distance cut threshold: merges stop once the closest pair of
 * clusters is farther apart than this. Tuned empirically during M3
 * against real MiniLM embeddings of a 25-note, 3-topic set (weather/
 * cooking/tech, ~8-9 notes each, deliberately varied wording within each
 * topic — see fixtures/linguistic/min-cluster-n.json for the exact set):
 * swept threshold 0.3-0.95 and scored each result against the known true
 * topic labels. General-purpose sentence embeddings for topically-related
 * but differently-worded sentences cluster far looser than intuition
 * suggests — thresholds below ~0.72 barely merged anything (20+ singleton
 * clusters out of 25 notes), and above ~0.9 collapsed into one mixed-topic
 * blob. The stable plateau recovering exactly the 3 true topics with zero
 * cross-topic contamination was threshold in [0.82, 0.88]; 0.85 sits at
 * its center for margin. Expressed as cosine *distance* (1 - similarity),
 * so 0.85 means "still grouped down to ~0.15 cosine similarity" — a real,
 * measured fact about this model, not a guess. Re-tune if the default
 * model ever changes (SPEC.md §9 "Version pins" applies here too). */
export const DEFAULT_CUT_THRESHOLD = 0.85;

export interface ClusterOptions {
  threshold?: number;
}

interface ActiveCluster {
  id: string;
  memberIndices: number[];
  memberNoteIds: string[];
}

export function clusterNotes(centroids: CentroidItem[], opts: ClusterOptions = {}): Cluster[] | null {
  const n = centroids.length;
  if (n < MIN_NOTES) return null;

  const threshold = opts.threshold ?? DEFAULT_CUT_THRESHOLD;

  // Base pairwise distance matrix over the original points.
  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = 1 - cosineSimilarity(centroids[i]!.embedding, centroids[j]!.embedding);
      dist[i]![j] = d;
      dist[j]![i] = d;
    }
  }

  let active: ActiveCluster[] = centroids.map((c, i) => ({
    id: `n${i}`,
    memberIndices: [i],
    memberNoteIds: [c.id],
  }));

  // clusterDist[a.id][b.id] mirrors `dist` but keyed by live cluster id and
  // updated in place via Lance-Williams as merges happen.
  const clusterDist = new Map<string, Map<string, number>>();
  for (let i = 0; i < n; i++) {
    const row = new Map<string, number>();
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      row.set(`n${j}`, dist[i]![j]!);
    }
    clusterDist.set(`n${i}`, row);
  }

  let mergeCounter = 0;

  while (active.length > 1) {
    // Find the closest pair, deterministically breaking ties by array
    // position (stable given the fixed input order).
    let bestI = -1;
    let bestJ = -1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d = clusterDist.get(active[i]!.id)!.get(active[j]!.id)!;
        if (d < bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestD > threshold) break;

    const a = active[bestI]!;
    const b = active[bestJ]!;
    const newId = `m${mergeCounter++}`;
    const sizeA = a.memberIndices.length;
    const sizeB = b.memberIndices.length;

    const newRow = new Map<string, number>();
    for (const other of active) {
      if (other === a || other === b) continue;
      const dA = clusterDist.get(a.id)!.get(other.id)!;
      const dB = clusterDist.get(b.id)!.get(other.id)!;
      // Lance-Williams, average linkage (UPGMA):
      const d = (sizeA * dA + sizeB * dB) / (sizeA + sizeB);
      newRow.set(other.id, d);
      clusterDist.get(other.id)!.set(newId, d);
      clusterDist.get(other.id)!.delete(a.id);
      clusterDist.get(other.id)!.delete(b.id);
    }
    clusterDist.delete(a.id);
    clusterDist.delete(b.id);
    clusterDist.set(newId, newRow);

    const merged: ActiveCluster = {
      id: newId,
      memberIndices: [...a.memberIndices, ...b.memberIndices],
      memberNoteIds: [...a.memberNoteIds, ...b.memberNoteIds],
    };
    active = [...active.filter((c) => c !== a && c !== b), merged];
  }

  return active.map((c) => ({ id: c.id, memberNoteIds: c.memberNoteIds }));
}
