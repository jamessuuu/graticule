import { describe, expect, it } from "vitest";
import { project, projectOnto } from "../src/project";

function vec(...xs: number[]): Float32Array {
  return new Float32Array(xs);
}

describe("project", () => {
  it("handles zero embeddings", () => {
    const result = project([]);
    expect(result.coords).toEqual([]);
    expect(result.varianceExplained).toEqual([0, 0]);
  });

  it("handles a single embedding (no variance to project)", () => {
    const result = project([vec(1, 2, 3, 4)]);
    expect(result.coords).toEqual([[0, 0]]);
    expect(result.varianceExplained).toEqual([0, 0]);
  });

  it("handles identical embeddings (zero variance)", () => {
    const result = project([vec(1, 2, 3), vec(1, 2, 3), vec(1, 2, 3)]);
    expect(result.varianceExplained).toEqual([0, 0]);
    for (const c of result.coords) expect(c).toEqual([0, 0]);
  });

  it("recovers the dominant axis of separation for well-separated clusters", () => {
    // Two tight clusters far apart along the x-axis, small jitter on other
    // axes. PC1 should capture almost all the variance, and coords should
    // separate the two clusters by sign on the first axis.
    const embeddings = [
      vec(10, 0.1, -0.1, 0),
      vec(10.1, -0.1, 0.05, 0.02),
      vec(9.9, 0.05, -0.05, -0.01),
      vec(-10, 0.1, -0.1, 0),
      vec(-10.1, -0.1, 0.05, 0.02),
      vec(-9.9, 0.05, -0.05, -0.01),
    ];
    const result = project(embeddings);
    expect(result.varianceExplained[0]).toBeGreaterThan(0.95);

    const groupA = result.coords.slice(0, 3).map((c) => c[0]);
    const groupB = result.coords.slice(3).map((c) => c[0]);
    const meanA = groupA.reduce((a, b) => a + b, 0) / groupA.length;
    const meanB = groupB.reduce((a, b) => a + b, 0) / groupB.length;
    // Opposite sides of the origin, clearly separated.
    expect(Math.sign(meanA)).not.toBe(Math.sign(meanB));
    expect(Math.abs(meanA - meanB)).toBeGreaterThan(15);
  });

  it("is deterministic: identical input produces byte-identical output", () => {
    const embeddings = [vec(1, 2, 3, 4, 5), vec(-2, 1, 0, 3, -1), vec(4, -4, 2, 0, 1), vec(0, 0, 1, 1, 1)];
    const a = project(embeddings.map((e) => new Float32Array(e)));
    const b = project(embeddings.map((e) => new Float32Array(e)));
    expect(a.coords).toEqual(b.coords);
    expect(a.varianceExplained).toEqual(b.varianceExplained);
  });

  it("varianceExplained components sum to at most 1", () => {
    const embeddings = [vec(1, 2, 3, 4), vec(-2, 1, 0, 3), vec(4, -4, 2, 0), vec(0, 0, 1, 1), vec(5, 5, -5, -5)];
    const result = project(embeddings);
    const sum = result.varianceExplained[0] + result.varianceExplained[1];
    expect(sum).toBeLessThanOrEqual(1.0000001);
    expect(sum).toBeGreaterThan(0);
  });
});

describe("projectOnto", () => {
  it("reproduces project()'s own coordinates when applied to the same embeddings that fit the basis", () => {
    const embeddings = [vec(1, 2, 3, 4), vec(-2, 1, 0, 3), vec(4, -4, 2, 0), vec(0, 0, 1, 1), vec(5, 5, -5, -5)];
    const fitted = project(embeddings);
    const reprojected = projectOnto(fitted, embeddings);
    for (let i = 0; i < embeddings.length; i++) {
      expect(reprojected[i]![0]).toBeCloseTo(fitted.coords[i]![0], 5);
      expect(reprojected[i]![1]).toBeCloseTo(fitted.coords[i]![1], 5);
    }
  });

  it("projects a centroid consistently with the chunk axes it derives from (Decision 3)", () => {
    const chunkEmbeddings = [vec(10, 0, 0), vec(10, 1, 0), vec(-10, 0, 0), vec(-10, -1, 0)];
    const fitted = project(chunkEmbeddings);
    // Centroid of the first two (a "note" whose chunks are the first pair).
    const centroid = vec(10, 0.5, 0);
    const [centroidCoord] = projectOnto(fitted, [centroid]);
    // The centroid should land on the positive side of PC1, consistent
    // with its own chunks.
    expect(Math.sign(centroidCoord![0])).toBe(Math.sign(fitted.coords[0]![0]));
  });
});
