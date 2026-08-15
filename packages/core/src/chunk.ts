/**
 * Chunking. SPEC.md §3 Decision 2, §13 failure contracts.
 *
 * Greedily accumulate sentences until adding the next would exceed
 * `maxTokens` subword tokens (counted with the model's own tokenizer,
 * never a word count) or the chunk already holds `maxSentences` sentences.
 *
 * A single sentence over `hardCeiling` tokens becomes its own chunk with
 * tokenizer-level truncation (never a raw character cut — the cut point is
 * always a grapheme boundary) and is flagged `truncated: true`.
 *
 * If `Intl.Segmenter` finds no sentence boundary anywhere in the note (the
 * Thai/Lao/Khmer case UAX #29 names as unsolved by default — the whole
 * note comes back as one "sentence"), truncating to `hardCeiling` would
 * silently discard most of the note. Instead this falls back to a
 * token-count-bounded split spanning the *entire* run, so the note is
 * never reduced to one undifferentiated, mostly-discarded blob. Trigger:
 * `segmentSentences` returns exactly one span for the whole note and that
 * span exceeds `hardCeiling` tokens — the strongest available signal that
 * the segmenter found no internal boundary at all (as opposed to one
 * legitimately long sentence among several normal ones, which still gets
 * the truncate-and-flag treatment above).
 */
import { segmentGraphemes, segmentSentences } from "./segment.js";
import type { Chunk, ChunkOptions, SentenceSpan } from "./types.js";

/** Binary search the largest grapheme-prefix length of `graphemes` (from
 * `startIdx`) whose text satisfies `countTokens(text) <= maxTokens`. Never
 * cuts inside a grapheme cluster because every candidate prefix ends on a
 * grapheme boundary by construction. Assumes token count is monotonic
 * non-decreasing in prefix length, true for every subword tokenizer in
 * practice. */
function truncateToTokenBudget(
  graphemes: string[],
  startIdx: number,
  endIdx: number,
  maxTokens: number,
  countTokens: (text: string) => number
): number {
  if (endIdx <= startIdx) return startIdx;
  // Binary search over prefix length in (startIdx, endIdx] for the largest
  // `end` with countTokens(graphemes[startIdx:end]) <= maxTokens. `lo` is
  // always known-good (fits the budget or is the forced-minimum
  // one-grapheme prefix); `hi` is always known-bad-or-boundary.
  let lo = startIdx + 1; // always kept — never emit an empty chunk
  let hi = endIdx;
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2);
    const candidate = graphemes.slice(startIdx, mid).join("");
    if (countTokens(candidate) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return Math.max(lo, startIdx + 1);
}

function makeChunk(
  graphemes: string[],
  start: number,
  end: number,
  order: number,
  noteId: string,
  tokenCount: number,
  truncated: boolean
): Chunk {
  return {
    id: `${noteId}-c${order}`,
    noteId,
    text: graphemes.slice(start, end).join(""),
    order,
    tokenCount,
    span: { start, end },
    truncated,
    embedding: new Float32Array(0),
  };
}

export function chunkNote(text: string, options: ChunkOptions): Chunk[] {
  const { maxTokens, maxSentences, hardCeiling, countTokens } = options;
  const noteId = options.noteId ?? "note";
  const graphemes = segmentGraphemes(text);
  if (graphemes.length === 0) return [];

  const sentences: SentenceSpan[] = segmentSentences(text, options.locale);
  if (sentences.length === 0) return [];

  const noBoundaryFound = sentences.length === 1;
  const chunks: Chunk[] = [];
  let order = 0;

  if (noBoundaryFound) {
    const only = sentences[0]!;
    const tokenCount = countTokens(only.text);
    if (tokenCount <= hardCeiling) {
      chunks.push(makeChunk(graphemes, only.span.start, only.span.end, order++, noteId, tokenCount, false));
      return chunks;
    }
    // No sentence boundary anywhere in a long run: token-bounded fallback
    // spanning the whole run. Never truncated — every grapheme is kept in
    // some chunk.
    let cursor = only.span.start;
    while (cursor < only.span.end) {
      const cut = truncateToTokenBudget(graphemes, cursor, only.span.end, maxTokens, countTokens);
      const tc = countTokens(graphemes.slice(cursor, cut).join(""));
      chunks.push(makeChunk(graphemes, cursor, cut, order++, noteId, tc, false));
      cursor = cut;
    }
    return chunks;
  }

  // Normal path: greedy sentence accumulation with per-sentence overflow
  // handling for any individual sentence that alone exceeds hardCeiling.
  let bufStart: number | null = null;
  let bufEnd = 0;
  let bufSentenceCount = 0;

  const flush = (): void => {
    if (bufStart === null) return;
    const tc = countTokens(graphemes.slice(bufStart, bufEnd).join(""));
    chunks.push(makeChunk(graphemes, bufStart, bufEnd, order++, noteId, tc, false));
    bufStart = null;
    bufEnd = 0;
    bufSentenceCount = 0;
  };

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence.text);

    if (sentenceTokens > hardCeiling) {
      // Flush whatever was accumulating, then this sentence becomes its
      // own truncated, flagged chunk.
      flush();
      const cut = truncateToTokenBudget(
        graphemes,
        sentence.span.start,
        sentence.span.end,
        hardCeiling,
        countTokens
      );
      const tc = countTokens(graphemes.slice(sentence.span.start, cut).join(""));
      chunks.push(makeChunk(graphemes, sentence.span.start, cut, order++, noteId, tc, true));
      continue;
    }

    if (bufStart === null) {
      bufStart = sentence.span.start;
      bufEnd = sentence.span.end;
      bufSentenceCount = 1;
      continue;
    }

    const combinedText = graphemes.slice(bufStart, sentence.span.end).join("");
    const combinedTokens = countTokens(combinedText);
    const wouldOverflowTokens = combinedTokens > maxTokens;
    const wouldOverflowSentences = bufSentenceCount + 1 > maxSentences;

    if (wouldOverflowTokens || wouldOverflowSentences) {
      flush();
      bufStart = sentence.span.start;
      bufEnd = sentence.span.end;
      bufSentenceCount = 1;
    } else {
      bufEnd = sentence.span.end;
      bufSentenceCount += 1;
    }
  }
  flush();

  return chunks;
}
