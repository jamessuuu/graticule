import { describe, expect, it } from "vitest";
import { generateCoverageEntries, formatCoveragePermittedStatement } from "../src/lib/coverage";
import type { LanguagesFixture } from "../src/lib/coverage";

const fixture: LanguagesFixture = {
  model: {
    id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    baseModel: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    citedFrom: "https://huggingface.co/...",
    citedField: "language: frontmatter",
    note: "",
  },
  tunedLanguages: [
    { bcp47: "en", name: "English" },
    { bcp47: "fr", name: "French" },
    { bcp47: "de", name: "German" },
  ],
  specialCases: [{ bcp47: "tl", name: "Filipino / Tagalog", note: "carve-out per SPEC.md §10" }],
};

describe("generateCoverageEntries", () => {
  it("marks English verified and every other tuned language unverified", () => {
    const entries = generateCoverageEntries(fixture, null);
    const en = entries.find((e) => e.bcp47 === "en")!;
    const fr = entries.find((e) => e.bcp47 === "fr")!;
    expect(en.status).toBe("verified");
    expect(fr.status).toBe("unverified");
  });

  it("marks Filipino unverified when the taglish fixture hasn't run", () => {
    const entries = generateCoverageEntries(fixture, null);
    const tl = entries.find((e) => e.bcp47 === "tl")!;
    expect(tl.status).toBe("unverified");
    expect(tl.evidence).toMatch(/not yet run/);
  });

  it("marks Filipino verified when the taglish fixture passes", () => {
    const entries = generateCoverageEntries(fixture, { passed: true, evidence: "cosine gap measured at 0.15" });
    const tl = entries.find((e) => e.bcp47 === "tl")!;
    expect(tl.status).toBe("verified");
    expect(tl.evidence).toBe("cosine gap measured at 0.15");
  });

  it("marks Filipino not-supported when the taglish fixture fails", () => {
    const entries = generateCoverageEntries(fixture, { passed: false, evidence: "no clear discrimination measured" });
    const tl = entries.find((e) => e.bcp47 === "tl")!;
    expect(tl.status).toBe("not-supported");
  });

  it("never asserts a language absent from both the tuned list and special cases", () => {
    const entries = generateCoverageEntries(fixture, null);
    expect(entries.find((e) => e.bcp47 === "zz")).toBeUndefined();
  });
});

describe("formatCoveragePermittedStatement", () => {
  it("uses the exact permitted phrasing from SPEC.md §10", () => {
    const entries = generateCoverageEntries(fixture, null);
    const statement = formatCoveragePermittedStatement(fixture, entries);
    expect(statement).toBe(
      "Tuned for roughly 3 languages, tested to date in English; other languages may work with reduced accuracy or may not be usable at all."
    );
  });
});
