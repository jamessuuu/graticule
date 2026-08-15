import { describe, expect, it } from "vitest";
import { percentile } from "../src/percentile";

describe("percentile", () => {
  it("returns null below the 10-pair floor (n < 5 notes)", () => {
    const allPairs = Array.from({ length: 9 }, (_, i) => i / 10);
    expect(percentile(0.5, allPairs)).toBeNull();
  });

  it("returns a value at exactly the 10-pair floor", () => {
    const allPairs = Array.from({ length: 10 }, (_, i) => i / 10); // 0.0 .. 0.9
    expect(percentile(0.9, allPairs)).not.toBeNull();
  });

  it("computes the expected rank for a clean distribution", () => {
    // 10 pairs, values 0.0..0.9. Querying values *not* in the population
    // isolates the below/above ranking from tie handling (covered
    // separately below).
    const allPairs = Array.from({ length: 10 }, (_, i) => i / 10);
    expect(percentile(0.95, allPairs)).toBe(100); // beats all 10
    expect(percentile(-0.05, allPairs)).toBe(0); // beats none
    expect(percentile(0.45, allPairs)).toBe(50); // beats exactly the bottom half
  });

  it("splits ties at 0.5 weight", () => {
    const allPairs = [0.1, 0.1, 0.5, 0.5, 0.5, 0.9, 0.9, 1.0, 1.0, 1.0];
    // For 0.5: 2 below, 3 equal (including itself), 5 above.
    // (2 + 0.5*3) / 10 * 100 = 35
    expect(percentile(0.5, allPairs)).toBe(35);
  });
});
