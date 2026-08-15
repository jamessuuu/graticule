import { describe, expect, it } from "vitest";
import { isSegmenterSupported, segmentGraphemes, segmentSentences } from "../src/segment.js";

describe("isSegmenterSupported", () => {
  it("is true in this test environment (Node has Intl.Segmenter)", () => {
    expect(isSegmenterSupported()).toBe(true);
  });
});

describe("segmentGraphemes", () => {
  it("splits plain ASCII into one entry per character", () => {
    expect(segmentGraphemes("abc")).toEqual(["a", "b", "c"]);
  });

  it("keeps a combining-mark sequence as a single grapheme cluster", () => {
    const text = "é"; // e + combining acute accent = "é" as two code points
    const graphemes = segmentGraphemes(text);
    expect(graphemes).toEqual([text]);
    expect(graphemes.length).toBe(1);
  });

  it("keeps a ZWJ family emoji sequence as a single grapheme cluster", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}"; // man+ZWJ+woman+ZWJ+girl+ZWJ+boy
    const graphemes = segmentGraphemes(`hi ${family}!`);
    expect(graphemes).toContain(family);
    // The family sequence must appear as exactly one element, not split
    // across several.
    const idx = graphemes.indexOf(family);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it("returns an empty array for empty text", () => {
    expect(segmentGraphemes("")).toEqual([]);
  });
});

describe("segmentSentences", () => {
  it("splits on sentence boundaries and spans reconstruct via graphemes", () => {
    const text = "The vendor confirmed the deadline. The invoice was late.";
    const spans = segmentSentences(text);
    expect(spans.length).toBe(2);
    const graphemes = segmentGraphemes(text);
    for (const s of spans) {
      expect(graphemes.slice(s.span.start, s.span.end).join("")).toBe(s.text);
    }
    // Spans are contiguous and cover the whole text.
    expect(spans[0]!.span.start).toBe(0);
    expect(spans[spans.length - 1]!.span.end).toBe(graphemes.length);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]!.span.start).toBe(spans[i - 1]!.span.end);
    }
  });

  it("splits on full-width CJK punctuation, never requiring ASCII periods", () => {
    const text = "今日は晴れです。散歩に行きました。とても気持ちがいいです。";
    const spans = segmentSentences(text);
    expect(spans.length).toBeGreaterThanOrEqual(3);
  });

  it("treats an unpunctuated long run as a single sentence (the Thai/Lao/Khmer case)", () => {
    // No sentence-final punctuation anywhere — Intl.Segmenter has nothing
    // to break on, which is exactly the case chunk.ts's fallback exists
    // for.
    const text = "wordone wordtwo wordthree wordfour wordfive wordsix wordseven";
    const spans = segmentSentences(text);
    expect(spans.length).toBe(1);
    expect(spans[0]!.text).toBe(text);
  });

  it("returns an empty array for empty text", () => {
    expect(segmentSentences("")).toEqual([]);
  });
});
