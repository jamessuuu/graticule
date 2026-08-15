import { describe, expect, it } from "vitest";
import { checkCaps, MAX_NOTES, MAX_TOTAL_CHARACTERS } from "../src/caps";

describe("checkCaps", () => {
  it("allows a normal add well under both caps", () => {
    const result = checkCaps({ noteCount: 5, totalCharacters: 500 }, "a short note");
    expect(result).toEqual({ allowed: true });
  });

  it("refuses when the note count cap would be exceeded", () => {
    const result = checkCaps({ noteCount: MAX_NOTES, totalCharacters: 0 }, "one more note");
    expect(result).toEqual({ allowed: false, reason: "notes" });
  });

  it("allows exactly at the note count boundary", () => {
    const result = checkCaps({ noteCount: MAX_NOTES - 1, totalCharacters: 0 }, "the 200th note");
    expect(result.allowed).toBe(true);
  });

  it("refuses when the character cap would be exceeded", () => {
    const bigNote = "x".repeat(1000);
    const result = checkCaps({ noteCount: 1, totalCharacters: MAX_TOTAL_CHARACTERS - 500 }, bigNote);
    expect(result).toEqual({ allowed: false, reason: "characters" });
  });

  it("allows exactly at the character boundary", () => {
    const note = "x".repeat(100);
    const result = checkCaps({ noteCount: 1, totalCharacters: MAX_TOTAL_CHARACTERS - 100 }, note);
    expect(result.allowed).toBe(true);
  });

  it("checks the note-count cap before the character cap when both would be exceeded", () => {
    const result = checkCaps(
      { noteCount: MAX_NOTES, totalCharacters: MAX_TOTAL_CHARACTERS },
      "x".repeat(1000)
    );
    expect(result).toEqual({ allowed: false, reason: "notes" });
  });
});
