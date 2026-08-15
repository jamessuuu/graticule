import { describe, expect, it } from "vitest";
import { clusterNotes } from "../src/cluster";

function vec(...xs: number[]): Float32Array {
  return new Float32Array(xs);
}

/** Five points jittered around a unit basis vector along `axis` (0/1/2),
 * in 3D — cosine similarity within a group stays near 1, and near 0
 * across groups (orthogonal axes), regardless of the tuned production
 * threshold. */
function jitteredGroup(axis: 0 | 1 | 2, prefix: string): { id: string; embedding: Float32Array }[] {
  const jitters = [0, 0.02, -0.02, 0.03, -0.01];
  return jitters.map((j, i) => {
    const base = [0, 0, 0];
    base[axis] = 1;
    base[(axis + 1) % 3] = j;
    return { id: `${prefix}${i}`, embedding: vec(base[0]!, base[1]!, base[2]!) };
  });
}

describe("clusterNotes", () => {
  it("returns null below the 15-note floor", () => {
    const centroids = jitteredGroup(0, "a").concat(jitteredGroup(1, "b"));
    expect(centroids.length).toBe(10);
    expect(clusterNotes(centroids)).toBeNull();
  });

  it("groups three well-separated clusters of 5 at n=15, with an explicit threshold", () => {
    const centroids = [...jitteredGroup(0, "a"), ...jitteredGroup(1, "b"), ...jitteredGroup(2, "c")];
    expect(centroids.length).toBe(15);
    const clusters = clusterNotes(centroids, { threshold: 0.3 });
    expect(clusters).not.toBeNull();
    expect(clusters!.length).toBe(3);
    const sizes = clusters!.map((c) => c.memberNoteIds.length).sort((x, y) => x - y);
    expect(sizes).toEqual([5, 5, 5]);
    // Every member of a cluster shares the same prefix (a/b/c) — no
    // cross-group bleed.
    for (const cluster of clusters!) {
      const prefixes = new Set(cluster.memberNoteIds.map((id) => id[0]));
      expect(prefixes.size).toBe(1);
    }
  });

  it("is deterministic: re-running the same input twice is identical", () => {
    const centroids = [...jitteredGroup(0, "a"), ...jitteredGroup(1, "b"), ...jitteredGroup(2, "c")];
    const r1 = clusterNotes(centroids, { threshold: 0.3 });
    const r2 = clusterNotes(centroids, { threshold: 0.3 });
    expect(r1).toEqual(r2);
  });

  it("a very high threshold merges everything into one cluster", () => {
    const centroids = [...jitteredGroup(0, "a"), ...jitteredGroup(1, "b"), ...jitteredGroup(2, "c")];
    const clusters = clusterNotes(centroids, { threshold: 10 });
    expect(clusters!.length).toBe(1);
    expect(clusters![0]!.memberNoteIds.length).toBe(15);
  });

  it("a very low threshold keeps every point in its own cluster", () => {
    const centroids = [...jitteredGroup(0, "a"), ...jitteredGroup(1, "b"), ...jitteredGroup(2, "c")];
    const clusters = clusterNotes(centroids, { threshold: 0 });
    expect(clusters!.length).toBe(15);
  });
});
