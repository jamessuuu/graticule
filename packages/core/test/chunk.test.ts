import { describe, expect, it } from "vitest";
import { chunkNote } from "../src/chunk.js";
import { segmentGraphemes } from "../src/segment.js";
import type { ChunkOptions } from "../src/types.js";

// A simple word-count tokenizer for algorithm tests. Real subword-token
// semantics (CJK density, Thai truncation, etc.) are covered by the
// fixture suite (scripts/verify-fixtures.mjs) against the real model
// tokenizer, per SPEC.md §14. These tests are about the chunking
// *algorithm* being correct for whatever countTokens returns.
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function opts(overrides: Partial<ChunkOptions> = {}): ChunkOptions {
  return {
    maxTokens: 5,
    maxSentences: 3,
    hardCeiling: 8,
    countTokens: wordCount,
    noteId: "note-1",
    ...overrides,
  };
}

function reconstruct(text: string, chunks: ReturnType<typeof chunkNote>): string {
  const graphemes = segmentGraphemes(text);
  return chunks.map((c) => graphemes.slice(c.span.start, c.span.end).join("")).join("");
}

describe("chunkNote", () => {
  it("returns an empty array for empty text", () => {
    expect(chunkNote("", opts())).toEqual([]);
  });

  it("puts a single short sentence in one untruncated chunk", () => {
    const text = "One short sentence.";
    const chunks = chunkNote(text, opts());
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.truncated).toBe(false);
    expect(chunks[0]!.text).toBe(text);
    expect(chunks[0]!.noteId).toBe("note-1");
    expect(chunks[0]!.id).toBe("note-1-c0");
  });

  it("merges consecutive short sentences under the token budget", () => {
    const text = "One two. Three four. Five six.";
    const chunks = chunkNote(text, opts({ maxTokens: 20, maxSentences: 3 }));
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.tokenCount).toBe(wordCount(text));
  });

  it("starts a new chunk once the token budget would be exceeded", () => {
    // Each sentence is 2 words; maxTokens=5 means at most 2 sentences (4
    // words) fit before a 3rd sentence (6 words) would exceed 5.
    const text = "Aa bb. Cc dd. Ee ff.";
    const chunks = chunkNote(text, opts({ maxTokens: 5, maxSentences: 10 }));
    expect(chunks.length).toBe(2);
    expect(chunks[0]!.text.trim()).toBe("Aa bb. Cc dd.");
    expect(chunks[1]!.text.trim()).toBe("Ee ff.");
  });

  it("starts a new chunk once maxSentences is reached even under the token budget", () => {
    const text = "A. B. C. D.";
    const chunks = chunkNote(text, opts({ maxTokens: 1000, maxSentences: 3 }));
    expect(chunks.length).toBe(2);
    expect(chunks[0]!.text.trim()).toBe("A. B. C.");
    expect(chunks[1]!.text.trim()).toBe("D.");
  });

  it("flags a single sentence over the hard ceiling as truncated, own chunk", () => {
    const text =
      "Short one. This sentence has way more than eight words in it so it must be truncated for sure. Short two.";
    const chunks = chunkNote(text, opts({ maxTokens: 5, maxSentences: 3, hardCeiling: 8 }));
    const truncatedChunks = chunks.filter((c) => c.truncated);
    expect(truncatedChunks.length).toBe(1);
    expect(truncatedChunks[0]!.tokenCount).toBeLessThanOrEqual(8);
    // Neighbouring short sentences are unaffected and untruncated.
    expect(chunks.some((c) => c.text.trim() === "Short one." && !c.truncated)).toBe(true);
    expect(chunks.some((c) => c.text.trim() === "Short two." && !c.truncated)).toBe(true);
  });

  it("never cuts truncation mid-grapheme (family emoji stays whole or is entirely excluded)", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
    const text = `${words.join(" ")} ${family} end.`;
    const chunks = chunkNote(text, opts({ maxTokens: 5, maxSentences: 3, hardCeiling: 10 }));
    for (const c of chunks) {
      if (c.text.includes("\u{1F468}")) {
        expect(c.text).toContain(family);
      }
    }
  });

  it("falls back to token-bounded splitting when no sentence boundary exists in a long run", () => {
    // No terminal punctuation anywhere: Intl.Segmenter returns one
    // "sentence" for the whole note. With hardCeiling=8 and 20 words, a
    // naive truncate-and-flag would keep only the first 8 words and
    // silently drop 12. The fallback must instead cover everything.
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkNote(text, opts({ maxTokens: 5, maxSentences: 3, hardCeiling: 8 }));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(8);
      expect(c.truncated).toBe(false);
    }
    // Full coverage: concatenating every chunk's text reconstructs the
    // original note exactly (never an undifferentiated blob, never silent
    // loss).
    expect(reconstruct(text, chunks)).toBe(text);
  });

  it("orders chunks with a monotonically increasing `order` field", () => {
    const text = "A. B. C. D. E. F.";
    const chunks = chunkNote(text, opts({ maxTokens: 2, maxSentences: 1 }));
    chunks.forEach((c, i) => expect(c.order).toBe(i));
  });

  it("every chunk starts with an empty (unset) embedding, filled in later by the model layer", () => {
    const chunks = chunkNote("Hello world.", opts());
    expect(chunks[0]!.embedding.length).toBe(0);
  });
});
