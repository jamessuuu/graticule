import { describe, expect, it } from "vitest";
import { outlierNote } from "../src/outlier";

function vec(...xs: number[]): Float32Array {
  return new Float32Array(xs);
}

describe("outlierNote", () => {
  it("returns null below the 3-note floor", () => {
    expect(outlierNote([])).toBeNull();
    expect(outlierNote([{ id: "a", embedding: vec(1, 0) }])).toBeNull();
    expect(
      outlierNote([
        { id: "a", embedding: vec(1, 0) },
        { id: "b", embedding: vec(0, 1) },
      ])
    ).toBeNull();
  });

  it("finds the note with the lowest mean similarity to the rest", () => {
    const centroids = [
      { id: "a", embedding: vec(1, 0, 0) },
      { id: "b", embedding: vec(0.9, 0.1, 0) },
      { id: "c", embedding: vec(0.95, 0.05, 0) },
      { id: "odd", embedding: vec(0, 0, 1) }, // orthogonal to the rest
    ];
    const result = outlierNote(centroids);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("odd");
  });

  it("is deterministic across repeated calls", () => {
    const centroids = [
      { id: "a", embedding: vec(1, 0, 0) },
      { id: "b", embedding: vec(0.9, 0.1, 0) },
      { id: "c", embedding: vec(0, 1, 0) },
    ];
    const r1 = outlierNote(centroids);
    const r2 = outlierNote(centroids);
    expect(r1).toEqual(r2);
  });
});
