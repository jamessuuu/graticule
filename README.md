# graticule

<img src="apps/web/public/brand/glyph-on-paper.svg" alt="" width="72" height="72" align="left" style="margin-right: 16px" />

A visitor pastes or drops their own short notes; the tool chunks them, embeds
them entirely on-device, and draws a live, honestly-captioned map of how
their wording relates — plus ranked search by meaning and a permanent,
in-product demonstration of where the underlying technique breaks (negation
blindness) and where its language claim does and does not hold (the coverage
table). No part of the pipeline leaves the browser tab.

<br clear="left" />

**Live:** graticule.vercel.app (once deployed — see `docs/DEVIATIONS.md` #1,
this build session never deploys) · **Source:** github.com/jamessuuu/graticule

## What it demonstrates, not just what it does

- **`/`** — the tool itself. Paste or drop notes; watch a live PCA map,
  ranked search, pairwise percentile, deterministic clustering, and outlier
  detection, each gated to a floor where the statistic stops being false
  precision. Preloaded on first visit with a 16-note sample corpus so the
  map is never empty.
- **`/limits`** — a contradiction pair and a genuine paraphrase pair, both
  raw cosine numbers visible on purpose: this technique measures wording
  similarity, not meaning, and a flat contradiction can score as similar as
  — or more similar than — a real paraphrase. Editable; recomputes from real
  live inference.
- **`/coverage`** — a language table generated at build time from the
  model's own published tuning list merged with this project's real fixture
  results, never hand-typed prose. English: verified. ~49 others: cited,
  not independently re-tested. Filipino/Tagalog: whatever the Taglish
  fixture actually measured.
- **`/methodology`** — why WASM instead of WebGPU (the real batch=1/32
  numbers, and an honest gap where a batch=8 figure isn't available), the
  version pins the numbers were measured against, and the historical
  finding that motivated `/limits` in the first place.
- **`/docs`** — the chunk → embed → project mechanism (with a diagram), the
  real limitations, and the literal, checkable condition that would prove
  the privacy claim false.

## Architecture

```
packages/core/     pure, isomorphic logic — segment | chunk | project (PCA) |
                    rank | percentile | cluster | outlier. Zero I/O, zero
                    model-loading; runs identically in Node (Vitest) and the
                    browser Worker.
packages/model/    the Embedder interface + two transformers.js
                    implementations — the only code that imports
                    @huggingface/transformers.
apps/web/          Next.js, static export, zero server functions.
  src/worker/       hosts model + core off the main thread.
fixtures/           linguistic fixtures, the sample corpus, the chunking
                    golden set, the model's coverage list — every number
                    the site shows traces back to one of these.
scripts/            real local inference (Node/onnxruntime-node) for CI
                    fixture and golden-set verification, $0 marginal cost.
```

Default model: `Xenova/all-MiniLM-L6-v2` (26.8MB, English-tuned). Optional,
gesture-gated multilingual upgrade: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
(140MB, ~50 languages per the model card). Both run WASM, not WebGPU — see
`/methodology` for the real numbers behind that choice. Nothing is
persisted: notes live in the tab and are gone on reload, by design.

Full spec: [`docs/SPEC.md`](docs/SPEC.md). Build status and milestone
progress: [`docs/PROGRESS.md`](docs/PROGRESS.md). Deliberate deviations from
the spec's literal text, with reasons: [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md).

## Develop

```sh
pnpm install
pnpm --filter @graticule/web dev
```

## Verify

```sh
pnpm run ci
# typecheck -> lint -> unit -> fixtures -> chunking-golden -> determinism -> build -> e2e
```

Individually:

```sh
pnpm run unit              # Vitest, packages/core + packages/model
pnpm run fixtures          # real local inference against the 9 SPEC.md §14 fixtures
pnpm run chunking-golden   # real local inference against >=20 golden chunking cases
pnpm run determinism       # CRLF/BOM/NFC-NFD/order-shuffle invariance, real inference
pnpm run build             # brand assets -> worker bundle -> next build -> zero-functions gate
pnpm run serve:static      # serve the static export locally (what the e2e suite targets)
pnpm run e2e:full          # Playwright, real inference in a real headless browser, no mocks
```

## Demo it locally

```sh
pnpm install
pnpm run build
pnpm run serve:static
# open http://localhost:4173
```

Every embedding, every number on the page, and every test in `pnpm run ci`
runs against the real model — nothing in this repo is mocked or
hand-typed where a real computation could produce the same line instead.

## License

MIT for the code — see [`LICENSE`](LICENSE), which also carries the brand
carve-out: the graticule name, wordmark, and glyph mark under
`apps/web/public/brand/` are excluded from the code grant. Fork the code
freely; don't fork the brand.

---

Built by James Lorenz Santos — [agentjames.vercel.app](https://agentjames.vercel.app)
