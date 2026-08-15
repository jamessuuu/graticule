/**
 * Segmentation primitives. UAX #29 locale-aware boundaries via
 * `Intl.Segmenter` only — never `.split('.')`, never whitespace.
 *
 * SPEC.md §3 Decision 2, §13 (Intl.Segmenter unsupported contract).
 */
import type { GraphemeSpan, SentenceSpan } from "./types";
import { SegmenterUnsupportedError } from "./types";

export function isSegmenterSupported(): boolean {
  return (
    typeof Intl !== "undefined" &&
    typeof (Intl as { Segmenter?: unknown }).Segmenter === "function"
  );
}

function assertSupported(): void {
  if (!isSegmenterSupported()) {
    throw new SegmenterUnsupportedError();
  }
}

/** Segments `text` into an array of grapheme clusters (user-perceived
 * characters). Every chunk/sentence span is expressed as indices into this
 * array, never UTF-16 code-unit offsets, so a family-emoji ZWJ sequence or
 * a combining-mark sequence is never split mid-cluster. */
export function segmentGraphemes(text: string): string[] {
  assertSupported();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const out: string[] = [];
  for (const s of segmenter.segment(text)) {
    out.push(s.segment);
  }
  return out;
}

/** Cumulative UTF-16 offsets for each grapheme boundary: `offsets[i]` is
 * the UTF-16 start offset of `graphemes[i]`; `offsets[graphemes.length]`
 * is `text.length`. Sentence/word boundaries from Intl.Segmenter always
 * fall on grapheme boundaries (UAX #29), so this is an exact map. */
export function graphemeBoundaryOffsets(graphemes: string[]): number[] {
  const offsets = new Array<number>(graphemes.length + 1);
  let acc = 0;
  offsets[0] = 0;
  for (let i = 0; i < graphemes.length; i++) {
    acc += graphemes[i]!.length;
    offsets[i + 1] = acc;
  }
  return offsets;
}

/** Binary search: smallest grapheme index `i` with `offsets[i] >= utf16Offset`. */
function utf16ToGraphemeIndex(offsets: number[], utf16Offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid]! < utf16Offset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Segments `text` into sentences (UAX #29 sentence boundaries), each
 * carrying a grapheme-cluster span so downstream chunking never deals in
 * UTF-16 code units. `locale` is passed straight through to
 * `Intl.Segmenter` (undefined = runtime default locale). */
export function segmentSentences(text: string, locale?: string): SentenceSpan[] {
  assertSupported();
  if (text.length === 0) return [];

  const graphemes = segmentGraphemes(text);
  const offsets = graphemeBoundaryOffsets(graphemes);

  const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  const starts: number[] = [];
  for (const s of segmenter.segment(text)) {
    starts.push(s.index);
  }
  starts.push(text.length);

  const spans: SentenceSpan[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const startU = starts[i]!;
    const endU = starts[i + 1]!;
    if (endU <= startU) continue; // guard against a zero-width segment
    const startG = utf16ToGraphemeIndex(offsets, startU);
    const endG = utf16ToGraphemeIndex(offsets, endU);
    if (endG <= startG) continue;
    const span: GraphemeSpan = { start: startG, end: endG };
    spans.push({ text: graphemes.slice(startG, endG).join(""), span });
  }
  return spans;
}
