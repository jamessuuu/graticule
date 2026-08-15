/**
 * PCA over the full chunk matrix, top-2 components only. SPEC.md §4
 * Decision 3: "linear, deterministic — same input, same output, unlike
 * t-SNE/UMAP." Implemented as power iteration with deflation directly on
 * the (mean-centered) data matrix — never materializes the full d×d
 * covariance matrix, so this stays fast at d=384 and arbitrary n.
 *
 * No randomness anywhere: the power-iteration seed vector is a fixed
 * deterministic pseudo-random-looking sequence (not Math.random), so the
 * same embeddings always produce the same axes, satisfying Decision 3
 * exactly.
 */
import type { ProjectionResult } from "./types.js";

const MAX_ITERATIONS = 500;
const CONVERGENCE_EPS = 1e-10;

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function norm(a: Float32Array): number {
  return Math.sqrt(dot(a, a));
}

/** Fixed, deterministic (non-random) seed vector for power iteration —
 * generic enough in practice to have nonzero overlap with the true
 * dominant eigenvector. */
function seedVector(dim: number): Float32Array {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    // A cheap deterministic pseudo-random-looking sequence in [-0.5, 0.5),
    // fixed for a given dimension — no Math.random, no Date.now().
    v[i] = (((i + 1) * 2654435761) % 100000) / 100000 - 0.5;
  }
  const n = norm(v);
  return n > 0 ? scaled(v, 1 / n) : v;
}

function scaled(a: Float32Array, s: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! * s;
  return out;
}

/** One power-iteration eigenvector extraction over centered data `X`
 * (array of row vectors). Returns a unit vector approximating the
 * dominant eigenvector of Xᵀ X, computed as repeated
 * `v ← Xᵀ(Xv)` without forming the d×d matrix. */
function dominantEigenvector(X: Float32Array[], dim: number): Float32Array {
  let v = seedVector(dim);
  if (X.length === 0) return v;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Xv: one scalar per row.
    const projections = new Float64Array(X.length);
    for (let i = 0; i < X.length; i++) projections[i] = dot(X[i]!, v);

    // Xᵀ(Xv): back into d-dim space.
    const next = new Float64Array(dim);
    for (let i = 0; i < X.length; i++) {
      const p = projections[i]!;
      if (p === 0) continue;
      const row = X[i]!;
      for (let d = 0; d < dim; d++) next[d] = (next[d] ?? 0) + p * row[d]!;
    }

    let nextNorm = 0;
    for (let d = 0; d < dim; d++) nextNorm += next[d]! * next[d]!;
    nextNorm = Math.sqrt(nextNorm);

    if (nextNorm === 0) {
      // Degenerate: no variance left in this direction (e.g. n<=1 point,
      // or a perfectly deflated remainder). Keep the current seed.
      return v;
    }

    const nextV = new Float32Array(dim);
    let dotWithPrev = 0;
    for (let d = 0; d < dim; d++) {
      nextV[d] = next[d]! / nextNorm;
      dotWithPrev += nextV[d]! * v[d]!;
    }

    const converged = 1 - Math.abs(dotWithPrev) < CONVERGENCE_EPS;
    v = nextV;
    if (converged) break;
  }
  return v;
}

/** Project each row of `X` onto unit vector `v`, subtract that component
 * from the row — the standard deflation step so the next power iteration
 * finds a direction orthogonal to `v`. */
function deflate(X: Float32Array[], v: Float32Array): Float32Array[] {
  return X.map((row) => {
    const p = dot(row, v);
    const out = new Float32Array(row.length);
    for (let d = 0; d < row.length; d++) out[d] = row[d]! - p * v[d]!;
    return out;
  });
}

/** Top-2 principal components over `embeddings`, plus the coordinates of
 * every input embedding projected onto them. See `types.ts` for why this
 * returns `components`/`mean` beyond the spec's inline sketch: centroids
 * need to be projected onto the *same* fitted axes afterward (Decision 3),
 * which requires exposing the basis. Use `projectOnto` for that. */
export function project(embeddings: Float32Array[]): ProjectionResult {
  const n = embeddings.length;
  if (n === 0) {
    const dim = 0;
    return {
      coords: [],
      varianceExplained: [0, 0],
      components: [new Float32Array(dim), new Float32Array(dim)],
      mean: new Float32Array(dim),
    };
  }
  const dim = embeddings[0]!.length;

  const mean = new Float32Array(dim);
  for (const e of embeddings) {
    for (let d = 0; d < dim; d++) mean[d] = (mean[d] ?? 0) + e[d]! / n;
  }

  const centered = embeddings.map((e) => {
    const out = new Float32Array(dim);
    for (let d = 0; d < dim; d++) out[d] = e[d]! - mean[d]!;
    return out;
  });

  let totalVariance = 0;
  for (const row of centered) totalVariance += dot(row, row);

  if (totalVariance === 0 || n === 1) {
    // No variance to project (identical points, or a single point).
    return {
      coords: embeddings.map(() => [0, 0]),
      varianceExplained: [0, 0],
      components: [new Float32Array(dim), new Float32Array(dim)],
      mean,
    };
  }

  const pc1 = dominantEigenvector(centered, dim);
  const deflated = deflate(centered, pc1);
  const pc2 = dominantEigenvector(deflated, dim);

  let lambda1 = 0;
  let lambda2 = 0;
  for (const row of centered) {
    const p1 = dot(row, pc1);
    lambda1 += p1 * p1;
    const p2 = dot(row, pc2);
    lambda2 += p2 * p2;
  }

  const coords: Array<[number, number]> = centered.map((row) => [dot(row, pc1), dot(row, pc2)]);

  return {
    coords,
    varianceExplained: [lambda1 / totalVariance, lambda2 / totalVariance],
    components: [pc1, pc2],
    mean,
  };
}

/** Projects `embeddings` onto an already-fitted basis (from `project()`)
 * without refitting — how centroids land on the same axes as the chunks
 * that fitted them (Decision 3). */
export function projectOnto(
  basis: Pick<ProjectionResult, "components" | "mean">,
  embeddings: Float32Array[]
): Array<[number, number]> {
  const [pc1, pc2] = basis.components;
  const dim = basis.mean.length;
  return embeddings.map((e) => {
    const centered = new Float32Array(dim);
    for (let d = 0; d < dim; d++) centered[d] = e[d]! - basis.mean[d]!;
    return [dot(centered, pc1), dot(centered, pc2)] as [number, number];
  });
}
