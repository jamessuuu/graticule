/**
 * Maps PCA-space coordinates onto a square pixel viewport, centered and
 * uniformly scaled so every point fits with room for markers at the
 * edges. Pure and shared between the Map component (apps/web) and the
 * `pca-instability-on-edit` fixture, which needs to measure "how many
 * pixels did this point move" using the *same* transform the map itself
 * renders with — otherwise the on-page receipt (SPEC.md §4: "Adding one
 * note moved your existing points by an average of Npx") would be
 * measuring a different geometry than what the visitor actually sees.
 */
export interface ViewportFit {
  scale: number;
  cx: number;
  cy: number;
}

export function fitProjectionToViewport(
  points: Array<{ x: number; y: number }>,
  viewportSize: number,
  padding: number
): ViewportFit {
  if (points.length === 0) return { scale: 1, cx: viewportSize / 2, cy: viewportSize / 2 };
  let maxAbs = 0;
  for (const p of points) {
    maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));
  }
  if (maxAbs === 0) maxAbs = 1;
  const usable = viewportSize / 2 - padding;
  return { scale: usable / maxAbs, cx: viewportSize / 2, cy: viewportSize / 2 };
}

export function projectToViewportPixels(
  point: { x: number; y: number },
  fit: ViewportFit
): { x: number; y: number } {
  return { x: fit.cx + point.x * fit.scale, y: fit.cy - point.y * fit.scale };
}
