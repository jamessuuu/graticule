# graticule — build progress

Tracks milestone completion against `docs/SPEC.md` §17. Updated as each
milestone lands; the authoritative state is always the git log + a green
`pnpm run ci`, not this file — but this file is where a resuming session
should look first.

| M | Deliverable | Status |
|---|---|---|
| M0 | Workspace, TS strict, CI, brand, zero-functions gate, static `/` | done |
| M1 | Chunking core + default embedder in a Worker + first real inference | done |
| M2 | PCA + dual markers + live typing + paste/drop + NFC dedupe + truncation + caps | done |
| M3 | Search + percentile + deterministic clustering + outlier, floors enforced | not started |
| M4 | `/limits` negation demo + `/coverage` wired to real fixture results | not started |
| M5 | Multilingual opt-in (gesture-gated) | not started |
| M6 | Sample corpus + hero + `/methodology` + Network Receipt + `/docs` | not started |
| M7 | Brand, accessibility pass, isomorphism + network e2e, README, review fixes | not started |

See `docs/DEVIATIONS.md` for every place the implementation departs from
SPEC.md's literal text, and why.

## Notes for a resuming session

- **Worker bundling is non-obvious.** The embedder Worker is NOT bundled by
  Next.js — `scripts/build-worker.mjs` pre-compiles it with esbuild into
  `apps/web/public/worker/embedder.worker.js`, run as part of `pnpm run
  build` (before `next build`). If you add imports to `embedder.worker.ts`
  or its dependency graph, that script is what needs re-running (`pnpm run
  build:worker`) — `next dev`/`next build` alone won't pick up changes to
  it. See `docs/DEVIATIONS.md` #8 for the full why.
- **Fixtures need `tsx`, not plain `node`.** `scripts/verify-fixtures.mjs`
  (and any future fixture/golden-set script) imports `@graticule/core`
  and `@graticule/model` by relative path from their TS source — run via
  `pnpm run fixtures`, which invokes `tsx`, not `node` directly.
- **The multilingual model's real language list is captured** in
  `fixtures/coverage/languages.json` (49 codes from the model card's own
  frontmatter, cited) — includes a `specialCases` entry for Filipino/
  Tagalog per SPEC.md §10's carve-out (its /coverage row comes from the
  `code-switch-taglish` fixture's real measurement, not the list).
- **Taglish fixture content is drafted but not yet in the repo.** 20
  grammatically-verified Taglish/EN-or-TL-paraphrase pairs are saved in
  this session's scratchpad (`taglish-draft-content.md`) pending: a
  localization-specialist/native-speaker authenticity pass, unrelated-
  sentence distractors, and real threshold measurement — do that work
  when M4 starts rather than re-requesting the content.
- **`useNotesSession`'s dedupe/caps checks read a `notesRef` mirror, not
  the `notes` state directly** — needed because React state updates from
  a moment ago may not have flushed into a closure yet when the next
  add/edit call needs a synchronous read. If you add another mutator,
  route it through `setNotesBoth` (keeps the ref in sync), not raw
  `setNotes`.
- **Two separate hidden `<input type="file">` elements, not one** —
  `webkitdirectory` forces a browser's native picker into folder-only
  mode unconditionally, so sharing one input between "Choose files" and
  the folder fallback would silently break plain multi-file selection.
  See `NoteWorkbench.tsx`.
- **A real hydration-mismatch bug was caught and fixed in M2**: reading
  `window`-dependent feature detection (`showDirectoryPicker` support)
  directly in a hook body during render differs between SSR and the
  client's first paint. Fixed via the standard `useState(false)` +
  `useEffect` "client-only" pattern in `useFileImport.ts`. Worth
  remembering as a pattern, not just a one-off fix, before adding any
  more `typeof window` / browser-API feature checks.
