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
| M3 | Search + percentile + deterministic clustering + outlier, floors enforced | done |
| M4 | `/limits` negation demo + `/coverage` wired to real fixture results | done |
| M5 | Multilingual opt-in (gesture-gated) | done |
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
  client's first paint. Originally fixed with `useState(false)` +
  `useEffect`; **M4 upgraded this and `useReducedMotion` to
  `useSyncExternalStore`** (the React-idiomatic API for exactly this —
  external, browser-only state read consistently across SSR/client),
  after wiring up `eslint-plugin-react-hooks` surfaced the pattern. Worth
  remembering before adding any more `typeof window` / browser-API
  feature checks: reach for `useSyncExternalStore` first, not
  useState+useEffect.
- **`eslint-plugin-react-hooks` (v7.1.1) is now wired in** (scoped to
  `apps/web/src/**`, `eslint.config.mjs`), added in M4 after the first
  self-inflicted CI failure from writing a disable comment for a rule
  that wasn't even registered. Its flat config ships far more than the
  classic rules-of-hooks/exhaustive-deps pair — including
  `set-state-in-effect`, which is right for external-store-subscription
  patterns but over-fires on the ordinary "kick off async work, track
  loading state in an effect" pattern; `NegationDemo.tsx` has one
  narrowly-scoped, commented `eslint-disable-next-line` for exactly that
  case rather than contorting the code to satisfy it.
- **`DEFAULT_CUT_THRESHOLD` (packages/core/src/cluster.ts) is empirically
  tuned, not a guess** — 0.85 (cosine distance), found by sweeping
  0.3-0.95 against a real 25-note/3-topic fixture and picking the plateau
  that recovers the true topics exactly. If you ever touch this value,
  re-run the sweep against `fixtures/linguistic/min-cluster-n.json`
  rather than picking a number by feel — general-purpose sentence
  embeddings cluster far looser than intuition suggests (most of 0.3-0.7
  barely merged anything).
- **The PCA-instability receipt is a pinned, fixture-verified constant,
  not a live per-session computation.** `Map.tsx` imports
  `fixtures/linguistic/pca-instability-on-edit.json` directly (cross-
  package relative import — works today because Next.js auto-detects the
  pnpm workspace root; re-check this if that ever changes) and renders
  its `expected.meanDisplacementPx`. `packages/core/src/viewport.ts`
  (`fitProjectionToViewport`/`projectToViewportPixels`) is shared between
  the Map's real rendering and the fixture's measurement specifically so
  the "Npx" number means the same pixels the visitor actually sees — if
  you change the map's viewport size/padding constants, the fixture's
  pinned numbers need re-measuring too.
- **A real race condition was caught by e2e testing, then fixed at the
  app level, in M3**: `NoteWorkbench`'s textarea stays enabled during an
  in-flight submission (only the button disables), so a fast typist
  really could start a second note before the first note's
  `setDraft("")` fires — the unconditional clear would silently clobber
  what they'd typed since. Fixed with a functional `setDraft((current) =>
  current === submittedText ? "" : current)` update. The e2e test that
  found it (`search-and-analysis.spec.ts`) needed its own fix too (wait
  for the textarea to actually read back empty before typing the next
  note) — both fixes are independently correct, not one working around
  the other.
- **`/coverage` is a Server Component that reads fixture JSON off disk at
  build time**, not a client component with a static import — deliberate,
  so `fixtures/linguistic/code-switch-taglish.json` (which didn't exist
  until partway through M4) could be handled gracefully via
  `existsSync()` rather than needing a conditional ESM import for a file
  that might not exist. `apps/web/src/lib/coverage.ts` is the pure,
  independently-tested generation logic (`generateCoverageEntries`,
  `formatCoveragePermittedStatement`); the page component is a thin
  wrapper that loads the two fixture files and calls it.
- **The Taglish fixture content pipeline was two agents, not one**:
  `computational-linguist` drafted+grammar-checked the 20 items (flagged
  its own non-native-speaker limits), then `localization-specialist`
  reviewed for register authenticity, fixed 3 items, wrote 20 distractor
  sentences, and — critically — recommended the coverage table hedge its
  claim to the specific register tested rather than a bare "verified"
  badge. `coverage.ts`'s `TaglishVerdict.note` carries that hedge
  verbatim onto the page; don't strip it out for brevity if this ever
  gets redesigned. Real measurement against the actual multilingual model
  (not assumed): 20/20 items passed, average discriminability gap 0.428,
  closest margin 0.0008 (item 14 — noted in the fixture as a near-miss
  worth knowing about even though it technically passed).
- **`switchModel`/`reembedding` already existed in `useNotesSession.ts`**
  (built ahead, during M4, since the Worker/session backend for
  model-switching needed no new plumbing beyond what M1 already built). M5
  added the UI (`ModelUpgrade.tsx`) on top of that existing backend.
- **`ModelLifecycle` and `ModelUpgrade` split ownership of the same shared
  `embedderState` by variant, not by having either poll the other.**
  Because there is one Worker and one `embedderState` for the whole page
  (Decision: "one Worker per page load"), a naive render of both
  components during a multilingual switch attempt double-messages the
  visitor — both show their own "loading — X%" line, and both show their
  own failure callout (`ModelLifecycle`'s generic "Try again" retries
  whatever `variant` last failed, which is confusing next to
  `ModelUpgrade`'s more correct "Continue with the smaller default
  model"). Fixed by making `ModelLifecycle` return `null` outright once
  `embedderState.variant === "multilingual"` — at that point
  `ModelUpgrade` fully owns the messaging (loading/ready/error) for that
  variant, and `ModelLifecycle` resumes once `switchModel("default")`
  flips `variant` back. Verified live: exactly one "ready" status line
  before, during, and after a real multilingual switch
  (`multilingual-upgrade.spec.ts` asserts the count is 1).
- **Deliberately did NOT make the note-submission form stay enabled while
  a multilingual switch downloads in the background**, even though it
  would have been possible: `embedder.worker.ts`'s module-level `embedder`
  variable is only reassigned on load *success* (never in the `catch`),
  so the Worker's currently-active (default) embedder stays fully
  functional for the entire duration of a multilingual download attempt,
  including if it fails. The tempting fix — gate the form on
  `embedderState.modelInfo !== null` instead of `status === "ready"`,
  since `modelInfo` is never cleared by a subsequent `loading`/`error`
  transition — was traced through to a real, if narrow, correctness race:
  a note submitted while a switch is resolving could have its
  `embedNoteDone` response arrive *after* `useNotesSession`'s
  `switchModel` re-embedding effect has already snapshotted `notesRef
  .current` and started re-embedding, so that one note would silently
  keep the old model's embedding forever, permanently mixing embedding
  spaces on the same map with no error. The current behaviour (whole form
  disabled for the ~20-30s of an optional, explicitly-opt-in download) is
  the safe, already-race-free choice; revisit only alongside a real fix
  for that race (e.g. reconciling the reembedding effect against notes
  added after its snapshot), not as a standalone UI tweak.
- **A real, load-bearing e2e locator bug was found and fixed while
  building M5's tests, then retroactively fixed in every other spec file
  using the same pattern.** `page.getByText(/model: .*ready/)` (used since
  M1) can resolve against a large ancestor element whose *aggregate*
  nested text also happens to satisfy the regex — confirmed empirically:
  it matched and returned a container still reading "model: loading…" as
  its own direct text, racing every assertion downstream of that wait
  against the wrong DOM state (this is what produced a spurious "0 bytes
  transferred" failure while building the M5 network-evidence check, and
  would have equally affected `real-inference.spec.ts`, which uses the
  identical pattern). Fixed everywhere by scoping to
  `page.getByRole("status").filter({ hasText: "ready (" })` instead — the
  app's own live-region markup (`role="status"` on every model-lifecycle
  paragraph) is a small, precise candidate set. Touched:
  `real-inference.spec.ts`, `file-import.spec.ts`,
  `map-interaction.spec.ts`, `search-and-analysis.spec.ts`,
  `multilingual-upgrade.spec.ts`. If a future test needs to wait on
  model-ready text again, use the role-scoped form, not a bare
  `getByText(regex)`.
- **The M5 gate's "allocation-failure fallback verified by a forced
  failure"** (SPEC.md §17) is `e2e/multilingual-upgrade.spec.ts`'s second
  test. Mechanism: `page.route("**/worker/embedder.worker.js", ...)`
  intercepts the request for the real, compiled Worker bundle and
  prepends a small shim (before the real bundle code runs) that overrides
  `self.fetch` to reject with a real `RangeError` — the exact shape
  `looksLikeAllocationFailure()` checks for — for any request naming the
  multilingual model, while passing every other request (the default
  model's own files) through to the real network untouched. This exercises
  the app's actual failure-detection and recovery code path end-to-end
  (not a mocked component), without needing real constrained-memory
  hardware — consistent with SPEC.md §9's "Tier B allocation risk...
  stays UNVERIFIED" being about not inventing a *measured threshold*
  number, not about forbidding a forced-failure test of the app's own
  handling.
