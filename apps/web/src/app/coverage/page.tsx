import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { generateCoverageEntries, formatCoveragePermittedStatement } from "@/lib/coverage";
import type { LanguagesFixture, TaglishVerdict } from "@/lib/coverage";

export const metadata = { title: "coverage" };

// Server Component (no "use client") — runs at build time during static
// export, so it can read the fixture files directly off disk rather than
// needing a conditional ESM import for a file (code-switch-taglish.json)
// that may not exist yet in every build. SPEC.md §10: "/coverage renders
// CoverageEntry[] generated at build time... never hand-typed prose."
function loadLanguagesFixture(): LanguagesFixture {
  const file = path.join(process.cwd(), "../../fixtures/coverage/languages.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadTaglishVerdict(): TaglishVerdict | null {
  const file = path.join(process.cwd(), "../../fixtures/linguistic/code-switch-taglish.json");
  if (!existsSync(file)) return null;
  const fixture = JSON.parse(readFileSync(file, "utf8"));
  return fixture.verdict ?? null;
}

const statusLabel: Record<string, string> = {
  verified: "verified",
  unverified: "unverified",
  "not-supported": "not supported",
};

export default function CoveragePage() {
  const languagesFixture = loadLanguagesFixture();
  const taglishVerdict = loadTaglishVerdict();
  const entries = generateCoverageEntries(languagesFixture, taglishVerdict);
  const permittedStatement = formatCoveragePermittedStatement(languagesFixture, entries);

  return (
    <div>
      <h1>Language coverage</h1>
      <p className="disclosure">{permittedStatement}</p>
      <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
        Source: {languagesFixture.model.baseModel}&apos;s own published tuning list ({languagesFixture.model.citedField}),
        merged with this project&apos;s real fixture results — generated at build time, never hand-typed.
      </p>

      <table style={{ marginTop: "1.5rem" }}>
        <thead>
          <tr>
            <th>Language</th>
            <th>BCP-47</th>
            <th>Status</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.bcp47}>
              <td>{e.language}</td>
              <td>
                <code>{e.bcp47}</code>
              </td>
              <td className={`status-${e.status}`}>{statusLabel[e.status]}</td>
              <td style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                {e.evidence}
                {e.note ? (
                  <>
                    <br />
                    <em>{e.note}</em>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="disclosure" style={{ marginTop: "1.5rem" }}>
        Every language above except English is only tuned per the underlying model&apos;s training, not
        independently re-verified by this project&apos;s own tests — Filipino/Tagalog is the one deliberate
        exception, tested directly (see the code-switch-taglish fixture). A language absent from this table
        entirely is not in the model&apos;s published tuning list at all.
      </p>
    </div>
  );
}
