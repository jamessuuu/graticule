# graticule — SPEC

**Project:** P7 (on-device semantic map of your own text) · **Status:** approved for build · **Date:** 2026-08-09
**Binds to:** PHASE-2.md, SELECTION-2.md (P7 definition, death condition, "binding changes from the
linguistic review," "Decisions from the Model Cards"), research/phase2-linguistic-spec.md (Linguistic
Spec + Verdict — its five required changes are binding, not advisory), research/phase2-model-cards.md
(P7 section), research/phase2-creative-tech.md §5.2, QUALITY-BAR.md, DESIGN-DIRECTION.md,
BRAND-KIT.md, PROGRAM.md (D1-D6).

**Name:** *graticule* — the reference grid a map is drawn against. In cartography and optics a
graticule is **recomputed for the frame it is drawn on**, which is precisely the honesty point this
project is required to make about its own axes every time a note is added. The name is load-bearing,
not decorative. npm: a placeholder name-probe squat (same weak-claim shape as sluice's 2013 dead
squat — resolve the same way). GitHub: no same-audience collision.

**Facts this spec is built on, captioned by source (do not re-measure without updating this line):**
default model `Xenova/all-MiniLM-L6-v2` q8 = 26.80MB / ~5.0-5.4s cold / 5.9-12.8ms per inference, WASM,
on a desktop that is **neither Tier A nor Tier B** (Ryzen 7 9700X / RX 9060 XT); multilingual upgrade
`Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8 = 140.38MB / ~24.25s cold / 763ms warm, 0 bytes, same
desktop; **WASM beats WebGPU 8-17x at batch=1** on both models, confirmed via real
`GPUAdapter.requestDevice()` calls against a non-fallback adapter; Filipino cross-lingual similarity
measured inconsistent (0.057-0.537 across two genuine paraphrase pairs, multilingual model); a
contradiction pair scored 0.517 against a genuine paraphrase's 0.537 (multilingual model) — the
negation-blindness finding. **Every Tier A/B row below is UNVERIFIED pending real-device measurement.**

## 1. Goal + non-goals

**Goal.** A visitor pastes or drops their own short notes; the tool chunks them, embeds them entirely
on-device, and draws a live, honestly-captioned map of how their wording relates — plus ranked search
by meaning and a permanent, in-product demonstration of where the underlying technique breaks
(negation blindness) and where its language claim does and does not hold (the coverage table). No part
of the pipeline leaves the browser tab.

**Non-goals (hard guards).** No chat box, no free-text "ask a question" input, no generation of any
kind — the model only measures and the product only visualizes (death condition, non-negotiable). No
accounts, no server-side persistence, no sharing surface. No bare cosine float anywhere except the one
deliberate exception in §6. No unqualified "works in your language" claim. No npm package, no CLI —
unlike sluice/chaff/snapgauge this ships no library; the product is the deployed site and its
inspectable source.

## 2. Data model

**Note** `{ id, text, source: "sample" | "visitor", createdAt, chunks: Chunk[], centroid: Float32Array }`
— in-memory only (Decision 9). **Chunk** `{ id, noteId, text, order, tokenCount, span: GraphemeSpan,
truncated: boolean, embedding: Float32Array }` — `span` is grapheme-cluster indices
(`Intl.Segmenter({granularity:'grapheme'})`), never UTF-16 code-unit indices. **Embedder** (interface,
§12). **Fixture** `{ id, kind: "structural" | "measured", input, assertion, expected }`.
**CoverageEntry** `{ language, bcp47, status: "verified" | "unverified" | "not-supported", evidence,
note }` — `/coverage` is generated from these, never hand-typed prose (mirrors chaff's "the catalog
cannot drift from the docs").

**Decision 9 — session-only, in-memory, no persistence in v1.** Pasted notes live in the tab and are
gone on reload; a "Save as JSON" button lets a visitor keep their own session file. A deliberate
privacy-first simplification (no plaintext quietly sitting in IndexedDB on a shared machine) traded
against a real cost (work lost on refresh) — named, not hidden. IndexedDB is a v2 candidate (§18).

## 3. Unit of analysis and segmentation

**Decision 1 — two granularities, never conflated.** Search ranks over **chunks** (fine-grained
recall). The map, clustering, outlier detection and percentile operate on **note centroids** (the mean
of a note's chunk embeddings) — "outlier" and "less similar to the rest" are claims about notes, not
fragments (linguistic-spec §1d).

**Decision 2 — chunking, concrete.** Segment with `Intl.Segmenter({granularity:'sentence'})` (UAX #29,
locale-aware — never `.split('.')`, never whitespace). Greedily accumulate sentences until adding the
next would exceed **80 subword tokens** (counted with the model's own tokenizer, never word count —
this matters most for CJK where token density differs) or the chunk holds 3 sentences. A single
sentence over the **128-token ceiling** becomes its own chunk with tokenizer-level truncation (never a
raw character cut — subword truncation cannot split a grapheme) and is flagged `truncated: true`. If
`Intl.Segmenter` finds no boundary in a long run (the Thai/Lao/Khmer case UAX #29 names as unsolved by
default), fall back to a token-count-bounded split — never emit one undifferentiated blob. A note with
any truncated chunk shows a visible inline marker ("only the part shown here was read by the model")
wherever it renders: the map may not imply the whole note was considered when it was not.

Note position = centroid, drawn as a larger solid marker; chunks are smaller and lighter — the
granularity must be legible on the map itself, not only in a tooltip.

## 4. The map: what it may and may not claim

**Decision 3 — PCA over the full chunk matrix; centroids projected onto the same axes.** Top-2
principal components computed client-side over every current chunk embedding (linear, deterministic —
same input, same output, unlike t-SNE/UMAP). Centroids project onto those same axes, so a note's
position stays consistent with its own chunks. Recomputed on every add/remove/edit (300ms debounce).

**Persistent disclosure beside the map (binding copy, from linguistic-spec §9, not paraphrased):**
> "This map places your notes by how similar their wording is, using a small language model that runs
> entirely in your browser — nothing you paste is sent anywhere. Position is relative to what you've
> pasted and will shift as you add or remove notes; it is not a fixed or absolute measurement."

Adjacent, live fixture-backed receipts: **"These two axes capture N% of the variation"**
(`(λ1+λ2)/Σλ`, computed live) and **"Adding one note moved your existing points by an average of Npx"**
— that number is produced by the `pca-instability-on-edit` fixture, so if the algorithm changes and
the measurement drifts, CI fails rather than letting the copy go stale.

**May assert:** local, nearest-neighbour proximity only. **Must never assert:** meaning in the distance
between far-apart points or clusters; stability across edits/sessions/reruns; that this projection is
"the" structure; that 2D isolation equals outlier status (outlier is computed pre-projection, in full
384-dim space, §5).

`prefers-reduced-motion`: point transitions snap instead of tweening.

## 5. The metric shown

**Decision 5 — never a bare cosine float** (anisotropy + arbitrariness make the absolute value
uninterpretable), with one labelled exception in §6.

- **Search:** an ordered list, no score. Copy: **"Ranked by similarity in wording/meaning — may not
  distinguish a statement from its opposite."**
- **Pairwise:** a within-session percentile against the visitor's own set, shown only at **n ≥ 5 notes
  (10 pairs)** — a percentile over 3 pairs is false precision. Copy: "more similar than N% of the other
  pairs you pasted."
- **Clustering:** shown only at **n ≥ 15**, the floor linguistic-spec §1c names as where assignment
  stops being dominated by two or three nearest points. Below: an inline "add N more notes" state,
  never a silently empty section. **Decision 4 — deterministic clustering:** agglomerative,
  average-linkage cosine over full-dimension centroids, fixed cut threshold tuned against
  `min-cluster-n`. k-means is rejected because random init would make the same paste produce different
  groups on different runs. Copy: **"Notes grouped by similar wording (automatic, not reviewed)"** —
  never "themes."
- **Outlier:** shown at **n ≥ 3**; lowest mean cosine similarity to every other centroid, in full
  embedding space, never read off the 2D map. Copy: **"Uses different wording than the rest."**
- **Sequential/drift is NOT built in v1** — the honest phrasing requires an ordering assumption that
  paste/drop does not provide, and forcing an order onto arbitrary notes to manufacture the feature
  would be inventing structure. Named here so it is not silently missing.

## 6. Negation blindness — the live demonstration

**Decision 6 — the one deliberate exception to "never a bare cosine."** A `/limits` page (linked from a
callout on `/`, not buried) shows a contradiction pair and a genuine paraphrase pair **side by side
with both raw cosine numbers visible**, because the entire point is that two very different claims land
on indistinguishable numbers — hiding the number would hide the finding. The metric name and its
limitation travel in the same element: "cosine similarity, [active model]".

Default pair, numbers populated from the committed fixture and **measured at build time against the
shipped default model** — the 0.517/0.537 figures were measured on the *multilingual* model, a
different artifact, and may not be reused verbatim:
- Contradiction: "The vendor confirmed the deadline." / "The vendor missed the deadline."
- Paraphrase: "The vendor confirmed the deadline." / "The vendor confirmed the due date."

Both boxes are **editable** — a skeptical visitor substitutes their own pairs and watches real live
inference (300ms debounce) recompute both numbers. `/methodology` cites the multilingual figures as the
historical justification the feature exists, captioned as measured on a different model.

## 7. Interaction and cold start

Paste or drop files/folder (File System Access API, `webkitdirectory` fallback — chaff's proven
pattern). Every add/edit/remove re-chunks, re-embeds only the changed note, and triggers a debounced
full recompute — reads as live because inference is 5.9-12.8ms (English, WASM, this desktop; Tier A/B
unverified).

**Cold start.** A **16-note English sample corpus** authored for this project (not scraped, no licence
question): ~5 notes across each of 3 loosely related topics plus one deliberate singleton outlier —
16 clears every floor (percentile ≥5, cluster ≥15, outlier ≥3), so a visitor with nothing to paste sees
the map, the groups and the outlier flag inside ten seconds. Samples carry a visible "sample" tag and a
single "Clear samples" action; a visitor's own notes are never visually indistinguishable from them.

**Caps:** 200 notes or 200,000 characters per session, then a clear refusal — not silent truncation of
input (per-sentence truncation per §3 is a separate, disclosed behaviour).

**Duplicates:** exact-match dedupe after `.normalize('NFC')` — the same sentence twice, or once NFC and
once NFD, surfaces a toast rather than a silent duplicate point.

## 8. Privacy, precisely

Reuses chaff's proven pattern (static disclosure + a link to the source file that would prove it wrong)
and adds a **live Network Receipt badge**: a `PerformanceObserver({type:'resource'})` counts real
resource-timing entries and renders the running total — "0 requests since you started typing" that
visibly stays 0 through paste/embed/search/cluster, incrementing only during the one-time model fetch.
Stronger than dev-tools instructions because it is self-verifying, and *itself falsifiable*: if it ever
undercounts, a visitor with dev tools open catches it immediately.

**What a cold visit's Network tab actually shows:** GETs to `cdn.jsdelivr.net` (~156KB runtime + ~4.5MB
ORT WASM) and `huggingface.co` (~26.8MB model + tokenizer; +140.38MB if the multilingual upgrade is
opted into) — real, visible, not nothing, and the page says so. **During typing/pasting/embedding:**
zero requests tied to text content; the CDN fetch is one-time and cached (Cache Storage via the
library's own wrapper — unlike MediaPipe's default behaviour, which P6's Model Card found re-downloads
every visit; verified against the **deployed** site in Playwright, not assumed from docs).
**For the claim to be false:** any request whose URL, query string or body encodes a fragment of pasted
text. If any page-view analytics exists at all it is scoped to route changes only and named in
`/docs/limitations`, checked in adversarial review.

## 9. Model lifecycle

**Decision 7 — `device: "wasm"` always, no capability probe, no fallback ladder.** Unlike P6/P8 this
project needs no GPU-absent branch: WASM won at every batch size tested (8.75x at batch=1, narrowing to
1.44x at batch=32, never crossing over), and WASM has near-universal support. `/methodology` states the
reason with the actual batch 1/8/32 table, because almost every browser-ML demo reaches for WebGPU and
gets this backwards at the batch size a paste-one-note-at-a-time product actually uses.

**Default** (Tier 1, 5-50MB band): `Xenova/all-MiniLM-L6-v2` q8, WASM. Lazy-loaded via
`requestIdleCallback` after first paint — never blocks the hero. Determinate progress from the real
fetch. Cold ~5.0-5.4s / warm ~300ms, 0 bytes (this desktop; Tier A/B unverified).

**Multilingual upgrade** (Tier 2 = explicit opt-in, gesture-gated, never auto-fetched):
`Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8. The button states the size before the click
("Load multilingual model — 140MB, one-time download") with a real byte-progress bar; the copy sets
the expectation plainly: "can take 20-30s on a fast connection, longer on mobile." Warm 763ms, 0 bytes.
Switching mid-session re-embeds every chunk and repeats the position-is-relative disclosure, because
the embedding space itself changed, not just the note set.

**Allocation failure.** Catch the `pipeline()` rejection; on an OOM/allocation shape show a labelled
static state — "This device couldn't load the [model] (likely a memory limit)" — and, if the
multilingual model failed, offer the smaller default. Never a blank frozen map, never a silent retry.
Tier B allocation risk for the 140MB model stays UNVERIFIED — no invented number.

**Version pins.** `@huggingface/transformers@4.2.0`, `onnxruntime-web@1.26.0-dev.20260416` — the exact
versions the cited numbers were measured against. A bump requires re-measuring before this doc or the
page claims them again (chaff's manifest discipline).

## 10. Language coverage disclosure (binding change #1, made the feature)

`/coverage` renders `CoverageEntry[]` generated at build time from the model's own published
50-language tuning list (cited) merged with real fixture results — never hand-typed prose that could
drift from what was tested. English: **verified**. The other ~49: **unverified** — "tuned per the model
card, not independently re-verified by this fixture set." Filipino/Tagalog: **whatever
`code-switch-taglish.json` actually measures** — not asserted here, computed. Any language absent from
the model's list: **not supported**, stated plainly, with no "the tokenizer won't error" hedge
presented as support.

No blanket "works in your language" line ships anywhere. The permitted statement, verbatim:
**"Tuned for roughly 50 languages, tested to date in [languages actually fixture-tested]; other
languages may work with reduced accuracy or may not be usable at all."**

## 11. Module / boundary map

```
graticule/                                 (pnpm workspace, public repo jamessuuu/graticule)
  packages/core/     segment | chunk | project (PCA) | rank | percentile | cluster | outlier
                     pure, isomorphic, zero I/O, zero model-loading — operates on already-computed
                     Float32Array embeddings, runs identically in Node (Vitest) and the browser Worker
  packages/model/    Embedder interface + the two transformers.js implementations — the ONLY code that
                     imports @huggingface/transformers, so core stays testable with a fake embedder
  apps/web/          Next.js, static export, ZERO server functions (chaff's precedent + the same
                     ci:zero-functions gate)
    src/worker/      hosts model + core off the main thread (chaff's Worker isolation)
    src/components/  Map, NoteList, SearchBox, NegationDemo, CoverageTable, ModelLifecycle,
                     NetworkReceipt
  fixtures/linguistic/*.json   the 9 fixtures (§14)
  fixtures/sample-corpus.json  the 16-note cold-start corpus
  fixtures/coverage/languages.json  the model's published tuning list, cited
  scripts/verify-fixtures.mjs  real local inference against measured fixtures, $0 in CI
```

**What stays isolated.** `core` never imports the model layer or the DOM. `model` is the only place
that can hold a CDN URL or a WASM binary; nothing in `core` knows a model exists.

## 12. API surface

```ts
// core — pure, sync
segmentSentences(text, locale?): SentenceSpan[]
segmentGraphemes(text): string[]
chunkNote(text, { maxTokens: 80, maxSentences: 3, hardCeiling: 128, countTokens }): Chunk[]
project(embeddings: Float32Array[]): { coords: [number,number][], varianceExplained: [number,number] }
rankBySimilarity(query: Float32Array, corpus: {id, embedding}[]): {id, rank}[]   // no scores
percentile(pair: number, allPairs: number[]): number | null      // null below n=5 notes
clusterNotes(centroids, opts): Cluster[] | null                  // null below n=15
outlierNote(centroids): { id, meanSimilarity } | null            // null below n=3

// model
interface Embedder {
  readonly modelId: string; readonly sizeMB: number;
  readonly languageCoverage: "en-only" | "multilingual-tuned-50";
  load(onProgress: (loaded: number, total: number) => void): Promise<void>;
  embed(texts: string[]): Promise<Float32Array[]>;
  cacheStatus(): Promise<"cold" | "warm">;
}
```

**Routes (static, no route handlers):** `/` (the tool; hero is the live map preloaded with the sample
corpus) · `/coverage` · `/limits` · `/methodology` · `/docs`.

## 13. Failure contracts

| Situation | Contract |
|---|---|
| Model CDN unreachable | `load()` rejects; static "map unavailable offline" state, never a silently empty canvas |
| Allocation failure (OOM-shaped) | Labelled state naming the likely cause; offers the smaller default if multilingual failed; never blank, never a silent retry |
| `Intl.Segmenter` unsupported | Feature-detected on load; honest "this browser is too old" state, never a crash |
| Sentence over 128 tokens | Tokenizer-level truncation, `truncated: true`, visible inline marker on that note |
| No sentence boundary in a long run (Thai/Lao/Khmer) | Token-count-bounded fallback; pass criterion is "does not silently blob," not "segmentation is perfect" |
| Duplicate paste (NFC/NFD or exact) | Deduped after NFC; toast, not a silent duplicate point |
| Session cap exceeded | Clear refusal; already-accepted input untouched |
| n below a feature's floor | Feature hidden with an inline "add N more" state, never a degraded version |
| WebGPU adapter absent | N/A by design — WASM-only, no probe exists to fail |
| `prefers-reduced-motion` | Transitions snap; progress bars still show real numbers |
| Any request encoding pasted text | The condition that falsifies the privacy claim; security review checks for it explicitly |
| Model version bumped | Cold-load numbers must be re-measured before any doc or page cites them again |

## 14. Fixture set (nine fixtures, all gate CI)

**Decision 8 — fixtures run real local inference in CI, $0.** Unlike chaff/tiltmeter's paid evals,
embedding inference has zero marginal cost, so `verify-fixtures.mjs` runs the actual model in Node
(`onnxruntime-node`) rather than mocking — strictly more honest than a snapshot. Because Node's
execution provider can differ marginally from the browser's WASM path, a Playwright check confirms the
same pairs recomputed live on the deployed site land within **±0.01 cosine** — an epsilon isomorphism
check, since an undisclaimed byte-identical claim across backends would itself be dishonest.

| Fixture | Asserts |
|---|---|
| `negation-pairs` | 10-15 contradiction pairs; CI snapshots recomputed cosines against the shipped default model; also greps demo copy for banned agreement-implying words ("agrees", "confirms", "matches") |
| `code-switch-taglish` | 15-20 Taglish sentences × EN/TL paraphrase; does cosine(Taglish, correct paraphrase) clearly exceed cosine(Taglish, unrelated)? **Its pass/fail wires directly into the Filipino row's status in `/coverage`** — the enforcement mechanism for binding change #1 |
| `cjk-no-ascii-punctuation` | Chinese/Japanese, zero ASCII punctuation; chunk count > 1 |
| `thai-no-space` | Thai paragraph, no spaces; chunk count > 1, every chunk ≤128 tokens |
| `grapheme-integrity` | Family-emoji ZWJ + combining marks; every substring/highlight reconstitutes from grapheme segments |
| `nfc-nfd-pair` | Same sentence NFC vs NFD; cosine ≈1.0; dedupe collapses them |
| `truncation-boundary` | ~90-word note (unflagged) vs ~180-word (flagged); the flagged note's position provably derives only from its truncated chunks |
| `min-cluster-n` | 5/12/25-note sets; clustering hidden at 5 and 12, shown at 25; re-running the same 25 twice is identical |
| `pca-instability-on-edit` | Fixed 10 notes, then +1; measures mean/max 2D displacement. **Its output ships as the on-page receipt in §4** |

## 15. Acceptance criteria

**Brand.** Chip-mark set; compact glyph favicon; footer on every page (chip + "Built by James Lorenz
Santos" + agentjames.vercel.app + repo); README lockup + portfolio footer; deterministic
`scripts/brand.mjs` generating the **graticule glyph: two horizontal and two vertical ink hairlines
forming a coordinate grid, with one plotted point deliberately OFF an intersection, in AMBER** — the
amber signal is the projected point, off-grid, because a projection is not a fixed coordinate.
Build-time OG image. MIT + `public/brand` carve-out. **No hire-me CTA (D1).**

**D-series.** D2 N/A, vacuously and correctly — no server model call exists, so there is no cost
ceiling to design (stated plainly per chaff's precedent, not faked as "handled"). D3: the landing page
renders with zero functions because there are none. D4/D5 N/A.

**QUALITY-BAR.** Every number generated from a fixture or a live computation, never hand-typed. No
banned marketing verbs. `/limits` and `/coverage` *are* the limitations requirement, made structural
rather than a prose afterthought. Works on the deployed site. Degrades honestly (§13). Keyboard
reachable; reduced-motion honoured; renders at 320px.

**Accessibility.** Contrast ≥4.5:1 on PAPER. The map has a non-visual equivalent — search already
returns a text list of closest pairs; surface it as the accessible alternative, not an afterthought.
The mechanism diagram (chunk → embed → project, with the recompute arrow in amber because that edge is
the honesty argument) carries a real `<title>`/`<desc>`.

## 16. Eval / golden set

Fixture suite (§14) at 100%; a chunking golden set of ≥20 realistic cases (English/CJK/Thai/RTL/mixed)
with committed expected chunk counts and truncation flags; a determinism eval (CRLF/LF, BOM, NFC/NFD,
order shuffle → identical output, coordinates compared with an epsilon rather than a false
byte-identical promise); the isomorphism check (Node vs deployed browser, ±0.01); a network-tab e2e
against the deployed site asserting zero requests carrying text content; and a self-check gate — the
deployed site loads its own sample corpus and completes paste→embed→map→search→cluster with zero
console errors (chaff's dogfood-gate equivalent).

CI: `typecheck → lint → unit → fixtures → e2e:smoke → build`.

## 17. Build order

| M | Deliverable | Green gate |
|---|---|---|
| **M0** | Workspace, TS strict, CI, brand, zero-functions gate, static `/` deployed | CI green; `/` live; zero-functions green |
| **M1** | Chunking core + default embedder in a Worker + first real inference | `cjk-no-ascii-punctuation`, `thai-no-space`, `grapheme-integrity` green; a real embedding verified in a real browser Network tab |
| **M2** | PCA + dual markers + live typing + paste/drop + NFC dedupe + truncation flagging + caps | `nfc-nfd-pair`, `truncation-boundary` green; map visibly redraws on edit |
| **M3** | Search (ranking only) + percentile + deterministic clustering + outlier, all floors enforced | `min-cluster-n`, `pca-instability-on-edit` green; the instability receipt wired into on-page copy |
| **M4** | `/limits` negation demo (editable, real inference) + `/coverage` wired to real fixture results | `negation-pairs`, `code-switch-taglish` green; the Filipino row shows the fixture's actual verdict |
| **M5** | Multilingual opt-in (gesture-gated, real progress, model-switch recompute) | Warm reload measured on the deployed site; allocation-failure fallback verified by a forced failure |
| **M6** | Sample corpus + hero + `/methodology` + Network Receipt + `/docs` | Self-check gate green on the deployed site; badge stays at 0 through a full cycle, verified live |
| **M7** | Brand, accessibility pass, isomorphism + network e2e, README, portfolio entry, review fixes | Full QUALITY-BAR green; isomorphism epsilon check green |

**Cut line.** M0-M4 plus a static `/` is the honest publishable floor. The negation demo and the
coverage disclosure are the most credible things on the page and are **not cuttable**. If the calendar
slips, cut in order: (1) M5's multilingual download — ship English-only with `/coverage` still showing
every other language as honestly untested; (2) the live Network Receipt — fall back to chaff's static
card; (3) `/docs` richness. **Never cut:** `/limits`, the PCA-instability receipt, the
unit-of-analysis decision, the never-bare-cosine rule, or the zero-server-functions architecture.

## 18. Open questions (deferred to the main session / James)

1. The exact agglomerative cut threshold — tuned against `min-cluster-n` during M3, documented in the
   code comment beside it, not invented here.
2. IndexedDB persistence — v2 candidate; v1 is session-only + JSON export by Decision 9. Revisit only
   with a real "clear my data" control designed alongside it, not bolted on.
3. PCA/clustering perf on Tier B — unmeasured; a real mid-range-Android pass using the same harness the
   Model Cards used (real headed browser, CDP capture) is the most important pre-M3 action.
4. npm/GitHub name resolution for `graticule` — resolve (scoped publish vs contest) when sluice's was.
5. Whether any page-view analytics ships at all — if so, scoped to route changes only, named in
   `/docs/limitations`, and covered by the review that verifies §8's falsification condition.
