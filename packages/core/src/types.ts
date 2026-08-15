/**
 * Shared types for graticule's pure core (segment | chunk | project | rank |
 * percentile | cluster | outlier). This module has zero I/O and zero
 * model-loading — it operates on already-computed Float32Array embeddings
 * and runs identically in Node (Vitest) and the browser Worker.
 *
 * SPEC.md §2 (Data model), §12 (API surface).
 */

/** A span expressed in grapheme-cluster indices (never UTF-16 code units).
 * `start` is inclusive, `end` is exclusive, both index into the array
 * produced by `segmentGraphemes(text)`. */
export interface GraphemeSpan {
  start: number;
  end: number;
}

/** One sentence, as found by `segmentSentences`. */
export interface SentenceSpan {
  text: string;
  span: GraphemeSpan;
}

export type NoteSource = "sample" | "visitor";

export interface Chunk {
  id: string;
  noteId: string;
  text: string;
  order: number;
  tokenCount: number;
  span: GraphemeSpan;
  truncated: boolean;
  embedding: Float32Array;
}

/** A Note as held in the session (Decision 9 — in-memory only, no
 * persistence in v1). `embedding` is intentionally absent from Chunk-less
 * notes prior to embedding; centroid is the mean of chunk embeddings. */
export interface Note {
  id: string;
  text: string;
  source: NoteSource;
  createdAt: number;
  chunks: Chunk[];
  centroid: Float32Array;
}

export type FixtureKind = "structural" | "measured";

export interface Fixture<TInput = unknown, TExpected = unknown> {
  id: string;
  kind: FixtureKind;
  input: TInput;
  assertion: string;
  expected: TExpected;
}

export type CoverageStatus = "verified" | "unverified" | "not-supported";

export interface CoverageEntry {
  language: string;
  bcp47: string;
  status: CoverageStatus;
  evidence: string;
  note: string;
}

/** A deterministic token counter over already-produced text, supplied by
 * the model layer (the model's own tokenizer — never a word count). Core
 * never imports a tokenizer; it is handed one. */
export type CountTokens = (text: string) => number;

export interface ChunkOptions {
  maxTokens: number;
  maxSentences: number;
  hardCeiling: number;
  countTokens: CountTokens;
  locale?: string;
  /** Not in the spec's inline API sketch, which shows `chunkNote(text,
   * opts)` with no note identity — but `Chunk.noteId` is required by the
   * data model (§2), so chunkNote needs somewhere to take it from. Defaults
   * to `"note"` when omitted so the function stays usable standalone (e.g.
   * in fixtures/tests that don't care about note identity). */
  noteId?: string;
}

export interface Cluster {
  id: string;
  memberNoteIds: string[];
}

export interface ProjectionResult {
  coords: Array<[number, number]>;
  /** [PC1 ratio, PC2 ratio] of total variance, each in [0,1]. The on-page
   * copy sums these to report "these two axes capture N% of the
   * variation" per SPEC.md §4. */
  varianceExplained: [number, number];
  /** The fitted basis, so centroids (or any other vector in the same
   * embedding space) can be projected onto the *same* axes without
   * refitting — SPEC.md Decision 3 ("centroids projected onto the same
   * axes"). Not in the spec's inline API sketch; required to implement
   * Decision 3 literally. See docs deviation note. */
  components: [Float32Array, Float32Array];
  mean: Float32Array;
}

export class SegmenterUnsupportedError extends Error {
  constructor() {
    super("Intl.Segmenter is not supported in this environment.");
    this.name = "SegmenterUnsupportedError";
  }
}
