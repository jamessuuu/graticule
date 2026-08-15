import { describe, expect, it } from "vitest";
import { isDuplicateText, normalizeForDedupe } from "../src/dedupe";

// Built from explicit codepoints, not typed directly -- a typed "e-acute"
// character is not reliably byte-identical across two spots in a file
// (confirmed the hard way while building the M1 grapheme-integrity
// fixture).
const E_ACUTE_NFC = String.fromCodePoint(0x00e9); // precomposed e-acute
const E_ACUTE_NFD = "e" + String.fromCodePoint(0x0301); // e + combining acute

describe("normalizeForDedupe", () => {
  it("normalizes NFD to NFC", () => {
    expect(E_ACUTE_NFC).not.toBe(E_ACUTE_NFD); // sanity: genuinely different byte sequences
    expect(normalizeForDedupe(E_ACUTE_NFD)).toBe(normalizeForDedupe(E_ACUTE_NFC));
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeForDedupe("  hello  ")).toBe("hello");
  });
});

describe("isDuplicateText", () => {
  it("detects an exact repeat", () => {
    expect(isDuplicateText("The vendor confirmed the deadline.", ["The vendor confirmed the deadline."])).toBe(true);
  });

  it("detects the same sentence once NFC and once NFD", () => {
    const nfcText = `Caf${E_ACUTE_NFC} today.`;
    const nfdText = `Caf${E_ACUTE_NFD} today.`;
    expect(nfcText).not.toBe(nfdText); // sanity: genuinely different strings
    expect(isDuplicateText(nfdText, [nfcText])).toBe(true);
    expect(isDuplicateText(nfcText, [nfdText])).toBe(true);
  });

  it("does not flag genuinely different text", () => {
    expect(isDuplicateText("A different note.", ["The vendor confirmed the deadline."])).toBe(false);
  });

  it("does not flag empty text as a duplicate of anything", () => {
    expect(isDuplicateText("", ["hello"])).toBe(false);
    expect(isDuplicateText("   ", [""])).toBe(false);
  });

  it("is case-sensitive (exact match only, not fuzzy)", () => {
    expect(isDuplicateText("Hello world", ["hello world"])).toBe(false);
  });
});
