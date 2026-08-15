import type { CoverageEntry, CoverageStatus } from "@graticule/core";

export interface TunedLanguage {
  bcp47: string;
  name: string;
}

export interface SpecialCaseLanguage {
  bcp47: string;
  name: string;
  note: string;
}

export interface LanguagesFixture {
  model: { id: string; baseModel: string; citedFrom: string; citedField: string; note: string };
  tunedLanguages: TunedLanguage[];
  specialCases: SpecialCaseLanguage[];
}

export interface TaglishVerdict {
  /** Whether the code-switch-taglish fixture's discriminability test
   * passed (cosine(Taglish, correct paraphrase) clearly exceeded
   * cosine(Taglish, unrelated)) — computed, not asserted (SPEC.md §10). */
  passed: boolean;
  evidence: string;
  /** The register-scoped caveat a localization-specialist review
   * required before this fixture's pass could read as "verified" on
   * /coverage — e.g. "tested in casual chat register only, not formal
   * Filipino or regional-language-inflected code-switching." Takes
   * precedence over the generic specialCase note so the hedge a reviewer
   * actually asked for doesn't get diluted by boilerplate. */
  note?: string;
}

const UNVERIFIED_EVIDENCE = "tuned per the model card, not independently re-verified by this fixture set";

/**
 * SPEC.md §10: `/coverage` is generated from the model's own published
 * tuning list merged with real fixture results, never hand-typed prose.
 * English is the only language this project independently tests broadly
 * (every fixture is authored/verified in English) — hence "verified"
 * rather than "unverified" like the other 49 listed languages, which are
 * only tuned-per-model-card. Filipino/Tagalog is a deliberate exception
 * to the blanket "absent from the list = not-supported" rule: its row
 * comes entirely from what `code-switch-taglish.json` actually measures.
 */
export function generateCoverageEntries(
  fixture: LanguagesFixture,
  taglishVerdict: TaglishVerdict | null
): CoverageEntry[] {
  const entries: CoverageEntry[] = [];

  for (const lang of fixture.tunedLanguages) {
    const isEnglish = lang.bcp47 === "en";
    entries.push({
      language: lang.name,
      bcp47: lang.bcp47,
      status: isEnglish ? "verified" : "unverified",
      evidence: isEnglish
        ? "every linguistic fixture in this project's test suite is authored and verified in English"
        : UNVERIFIED_EVIDENCE,
      note: isEnglish ? "" : `Part of ${fixture.model.baseModel}'s published tuning list (${fixture.model.citedFrom}).`,
    });
  }

  for (const special of fixture.specialCases) {
    if (special.bcp47 !== "tl") continue; // the only special case defined today
    let status: CoverageStatus;
    let evidence: string;
    let note = special.note;
    if (taglishVerdict === null) {
      status = "unverified";
      evidence = "code-switch-taglish fixture not yet run in this build";
    } else if (taglishVerdict.passed) {
      status = "verified";
      evidence = taglishVerdict.evidence;
      note = taglishVerdict.note ?? special.note;
    } else {
      status = "not-supported";
      evidence = taglishVerdict.evidence;
      note = taglishVerdict.note ?? special.note;
    }
    entries.push({ language: special.name, bcp47: special.bcp47, status, evidence, note });
  }

  return entries;
}

export function formatCoveragePermittedStatement(fixture: LanguagesFixture, entries: CoverageEntry[]): string {
  const tested = entries.filter((e) => e.status === "verified").map((e) => e.language);
  const list = tested.length > 0 ? tested.join(", ") : "none yet";
  return `Tuned for roughly ${fixture.tunedLanguages.length} languages, tested to date in ${list}; other languages may work with reduced accuracy or may not be usable at all.`;
}
