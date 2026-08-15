import { describe, expect, it } from "vitest";
import { fitProjectionToViewport, projectToViewportPixels } from "../src/viewport";

describe("fitProjectionToViewport", () => {
  it("centers an empty set at the viewport middle", () => {
    const fit = fitProjectionToViewport([], 600, 40);
    expect(fit.cx).toBe(300);
    expect(fit.cy).toBe(300);
  });

  it("scales the largest coordinate to just inside the padded edge", () => {
    const points = [{ x: 10, y: 0 }, { x: -5, y: 5 }];
    const fit = fitProjectionToViewport(points, 600, 40);
    // usable half-extent = 300 - 40 = 260; largest abs coordinate = 10
    expect(fit.scale).toBeCloseTo(260 / 10, 5);
  });

  it("guards against an all-zero point set (avoids divide by zero)", () => {
    const fit = fitProjectionToViewport([{ x: 0, y: 0 }], 600, 40);
    expect(Number.isFinite(fit.scale)).toBe(true);
  });
});

describe("projectToViewportPixels", () => {
  it("maps the origin to the viewport center", () => {
    const fit = fitProjectionToViewport([{ x: 10, y: 10 }], 600, 40);
    const px = projectToViewportPixels({ x: 0, y: 0 }, fit);
    expect(px.x).toBe(fit.cx);
    expect(px.y).toBe(fit.cy);
  });

  it("flips y (positive PCA-space y goes up on screen, so pixel y decreases)", () => {
    const fit = fitProjectionToViewport([{ x: 10, y: 10 }], 600, 40);
    const px = projectToViewportPixels({ x: 0, y: 10 }, fit);
    expect(px.y).toBeLessThan(fit.cy);
  });
});
