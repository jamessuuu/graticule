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
| M6 | Sample corpus + hero + `/methodology` + Network Receipt + `/docs` | done |
| M7 | Brand, accessibility pass, isomorphism + network e2e, README, review fixes | done |

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
- **The hero's sample-corpus auto-preload (M6) is a real, session-wide
  behaviour change, not just a home-page addition** — every fresh
  session now auto-embeds 16 sample notes the moment the default model
  becomes ready (`useSampleCorpusPreload.ts`, fired once via a
  `triggered` ref, guarded against stomping real content if a visitor
  somehow pastes before it fires). This broke five already-passing e2e
  tests that assumed an empty note list at the start (`file-import`,
  `map-interaction`, `real-inference`, `search-and-analysis`, and one of
  `multilingual-upgrade`'s two tests) — all fixed the same way, not by
  weakening the assertions: `e2e/helpers.ts`'s `clearSampleCorpus(page)`
  waits for all 16 `.tag-sample` notes to finish loading (never
  partial — the preload's own sequential loop would just re-add whatever
  it hadn't reached yet if "Clear samples" were clicked mid-load) then
  clicks "Clear samples" and waits for the count to read back 0. If a
  new e2e test drives the note-taking form from a fresh page load, it
  needs this same call before its own logic, or it will silently start
  from 16 notes instead of 0.
- **Known, narrow, low-priority UX gap (not fixed): a visitor who clicks
  "Clear samples" WHILE the initial 16 are still auto-loading (a roughly
  1-2 second window) will see some samples reappear**, because the
  preload's `for` loop keeps calling `addNote` for whatever it hasn't
  reached yet, independent of the clear action. `e2e/helpers.ts` sidesteps
  this in tests by always waiting for the full 16 before clearing. Worth
  fixing properly (e.g. a cancellation flag the clear action sets) if this
  ever becomes a real reported issue; not worth the complexity pre-emptively
  for a window this narrow with this low a cost (mild confusion, not data
  loss).
- **The Network Receipt (`NetworkReceipt.tsx` / `useNetworkReceipt.ts` /
  `useEmbedderWorker.ts`'s `workerNetworkRequests`) has to be architected
  around a real browser fact, not a simplification**: a dedicated Worker
  has its own, independent Resource Timing / `PerformanceObserver`
  timeline — entries for requests the Worker itself issues (the model,
  tokenizer, and ONNX runtime fetches) never appear on the main
  document's `window.performance`, and the reverse is also true. Confirmed
  empirically while investigating an unrelated e2e byte-count anomaly
  during M5 (`page.on('response')` also never sees Worker-issued
  requests). The fix: `embedder.worker.ts` runs its own
  `PerformanceObserver({type:'resource', buffered:true})` and posts a
  running total back to the main thread (`networkCount` in `protocol.ts`);
  `useNetworkReceipt.ts` combines that with its own main-thread observer
  (page assets, the Worker *script* request itself) into one number, then
  snapshots a baseline the moment the model first becomes ready so the
  displayed "N since the map became interactive" is a real, live,
  falsifiable delta, not a static claim.
- **`react-hooks/refs` and `react-hooks/set-state-in-effect` (both part of
  `eslint-plugin-react-hooks@^7.1.1`'s stricter rule set, wired in M4)
  reject two patterns that used to be common React idiom**: mutating
  *or reading* a ref during render (even an idempotent, guarded
  lazy-snapshot) and calling `setState` synchronously inside an effect
  body. `useNetworkReceipt.ts`'s baseline-snapshot needed a real rewrite,
  not a disable comment, to satisfy both: it uses react.dev's own
  documented "adjust state during render" pattern (store `prevModelReady`
  and `baseline` as plain `useState`, compare-and-set directly in the
  render body, guarded so it only ever fires once) rather than a ref or
  an effect. Worth remembering before reaching for `useRef` to "remember
  something across renders without a re-render" — this codebase's lint
  config no longer allows reading that ref back during render either.
- **`/methodology`'s WASM-vs-WebGPU table is honestly incomplete, on
  purpose.** SPEC.md's own facts line and §9 give real, cited batch=1
  (8.75x) and batch=32 (1.44x) multipliers but no batch=8 datapoint —
  the external research doc that measured it (`research/phase2-creative-
  tech.md §5.2`, per SPEC.md's "Binds to" line) isn't part of this repo.
  The page states this gap plainly ("not separately measured — see note
  below") rather than interpolating a plausible-looking number between
  8.75x and 1.44x, which would be exactly the kind of invented figure the
  hard rules forbid. See `docs/DEVIATIONS.md` #10.

## M7 notes

- **The chunking golden set (`fixtures/chunking-golden.json`, 24 cases —
  floor is >=20) mixes freshly-authored and reused content deliberately.**
  English cases are original; the CJK and Thai cases are reused verbatim
  from the already-verified M1 fixtures rather than re-authored (no reason
  to duplicate content that already has a real, reviewed provenance); the
  "mixed" cases are 4 items reused from `code-switch-taglish.json`; the RTL
  (Arabic/Hebrew) cases were drafted by the `computational-linguist` agent,
  a self-disclosed non-native speaker, with one phrase corrected mid-draft
  because the agent couldn't corpus-verify it and cut it rather than ship
  a guess — same disclosure discipline as the Thai/CJK content in M1. One
  English case (`en-long-run-on-exceeds-hard-ceiling`) revealed a real,
  worth-knowing chunking-algorithm fact while being authored: a single
  128+-token sentence with *nothing else in the note* takes the
  no-boundary-fallback path (multi-chunk, never flagged truncated), not
  the mid-note truncate-and-flag path — those are two genuinely different
  code paths in `chunkNote()`, both real, both now covered.
- **The determinism eval (`scripts/verify-determinism.mjs`) needed to
  read `packages/core/src/chunk.ts` first to get the claim right**:
  `chunkNote()` does not normalize its input text at all (no NFC
  call anywhere), so an NFD-encoded note is a genuinely different byte
  sequence from its NFC form — the honest claim is "chunk structure is
  identical, embeddings are near-identical (cosine >= 0.999)," not
  byte-identical anything. The order-shuffle check re-associates each
  note's projected coordinate by its own id, not by array position,
  before comparing — `project()`'s `coords` array order tracks input
  order even though the fitted PCA basis itself doesn't depend on it, so
  comparing by index would find a trivial, meaningless "difference" that
  is really just the shuffle.
- **The isomorphism e2e (SPEC.md §14, ±0.01 cosine) and the network-tab
  e2e (SPEC.md §16, zero requests carrying pasted text) are deliberately
  separate tests from the Network Receipt's own e2e coverage** — the
  receipt only counts requests, it doesn't inspect what they contain.
  `e2e/isomorphism-and-network-content.spec.ts`'s second test pastes a
  single distinctive canary string, then adds/searches/edits it, and
  asserts the string never appears in any request URL, query string, or
  body — the literal SPEC.md §8 falsification condition, checked directly
  rather than inferred from the receipt staying flat.
- **A real accessibility-engineer dispatch found four must-fix and four
  should-fix WCAG issues from a source-only read (no browser tools in
  that dispatch) — all fixed, not just logged:**
  - `NoteWorkbench.tsx`'s inline-edit textarea had no accessible name —
    added `aria-label="Edit note text"`.
  - `NegationDemo.tsx`'s textarea borders used `--line` against `--paper`
    (~1.39:1, needs 3:1 for a UI-component boundary) — swapped to
    `--line-strong`; its two "Text A"/"Text B" labels were identical
    across both pair-boxes (ambiguous in a screen-reader's forms list) —
    prefixed with the pair's own label ("Contradiction — Text A"); the
    live-recomputed cosine and verdict paragraphs had no live region —
    both got `role="status"`.
  - **`Map.tsx`'s per-note markers claimed `role="button"`/keyboard
    support they could not actually deliver**: an interactive role nested
    inside the map SVG's own `role="img"` is flattened out of the
    accessibility tree by that ancestor role (a real, verified browser
    behaviour, not a guess) — a sighted keyboard user could still Tab
    there via raw DOM focus, but a screen-reader user could never
    discover or operate it, so the old markup was a false promise, worse
    than not claiming it. Fixed by splitting each marker into two SVG
    circles inside a `<g data-testid="map-note-marker">`: an invisible,
    larger (24px, SC 2.5.8) hit-target circle carrying the real
    `onClick`/hover handlers for sighted mouse/touch users, and the
    visible dot underneath with `pointerEvents: "none"` and no
    interactive role at all. Selecting a marker only ever enlarged its
    own dot (verified — nothing else read `selectedNoteId`), so removing
    the fake keyboard path loses no real functionality; the map's actual
    accessible equivalent remains `SessionAnalysis`'s text list, per
    SPEC.md §15. Verified live (not just by the passing e2e suite): a
    real Tab-key walkthrough now goes straight from the "Load
    multilingual model" button to the note textarea, skipping the map
    entirely, instead of getting stuck cycling through N dead circle
    "buttons." **e2e note:** `file-import.spec.ts` and
    `map-interaction.spec.ts` counted markers via
    `svg[role="img"] [role="button"]`, which this fix makes match
    nothing — both now use the `[data-testid="map-note-marker"]` test
    hook instead (a plain test attribute, not an accessibility one).
  - `SearchBox.tsx` results had no count announcement — added a
    `role="status"` "`N results.`" line. `ModelUpgrade.tsx`'s failure
    copy had no live region (inconsistent with `ModelLifecycle.tsx`'s
    equivalent `role="alert"`) — wrapped in one. `ToastStack.tsx`'s
    icon-only dismiss button had no minimum touch-target sizing — given
    `min-width`/`min-height: 44px`.
  - Contrast on `--paper` for every other token, reduced-motion coverage,
    landmark/heading structure, and every other form label were already
    verified correct by the same dispatch — not re-litigated here.
- **QUALITY-BAR's "renders at 320px" caught a real bug, not a
  hypothetical one**: `/coverage`'s 4-column table (including a long
  free-text "evidence" column) forced the *entire page* to scroll
  horizontally at 320px, not just the table. Fixed by wrapping both
  `/coverage`'s and `/methodology`'s tables in their own
  `overflow-x: auto` container with a `min-width` on the `<table>` — the
  table scrolls internally now, the page never does. Locked in with
  `e2e/quality-bar.spec.ts`, which checks all 5 routes at a real 320px
  viewport for zero page-level horizontal overflow, so this can't
  silently regress.
- **The OG image (`apps/web/src/app/opengraph-image.tsx`) needed
  `export const dynamic = "force-static"`** to build under
  `output: "export"` — Next.js's static-export mode refuses to collect
  page data for an image-generation route without it, even with no
  dynamic params. Rebuilds the exact grid-plus-off-intersection-amber-
  point geometry `scripts/brand.mjs` uses, as plain positioned `<div>`s
  rather than inline SVG — `next/og`'s Satori renderer supports that more
  reliably than raw `<svg>` markup. Real 1200x630 PNG, generated once at
  build time (confirmed: `apps/web/out/opengraph-image`, valid PNG,
  ~24KB), not per-request.
- **"Portfolio entry" (SPEC.md §17's M7 deliverable) is out of scope for
  this repo** — it refers to the separate `agentjames` portfolio site,
  which the hard rules explicitly forbid touching from a graticule
  session ("touch nothing outside `C:\Users\admin\graticule`"). Left for
  a human decision outside this build.
