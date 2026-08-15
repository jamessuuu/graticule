import { describe, expect, it } from "vitest";
import { centroid } from "../src/centroid";

describe("centroid", () => {
  it("returns an empty vector for no embeddings", () => {
    expect(centroid([])).toEqual(new Float32Array(0));
  });

  it("returns the single embedding unchanged for one chunk", () => {
    const e = new Float32Array([1, 2, 3]);
    expect(Array.from(centroid([e]))).toEqual([1, 2, 3]);
  });

  it("computes the mean across chunks", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const c = new Float32Array([0, 0, 1]);
    const result = centroid([a, b, c]);
    expect(result[0]).toBeCloseTo(1 / 3, 5);
    expect(result[1]).toBeCloseTo(1 / 3, 5);
    expect(result[2]).toBeCloseTo(1 / 3, 5);
  });
});
