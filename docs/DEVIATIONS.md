# Deviations from SPEC.md

Running log of every place the implementation departs from SPEC.md's literal
text, and why. Per the build brief: "Where any doc conflicts with repo
reality, the repo wins" — this file is the record of *why* the repo made
the call it did, so a future reader isn't left guessing.

## Hard-rule-forced

1. **"Deployed site" = a local static server, not a public URL.** The build
   brief prohibits any deploy, git push, or new remote from this session.
   Every SPEC.md gate phrased as "verified against the deployed site" (M1's
   real Network-tab check, M6's self-check gate, M7's isomorphism/network
   e2e) is instead run against `next build`'s real static export (`apps/web/
   out/`) served locally by `scripts/serve-static.mjs` over plain HTTP. The
   artifact under test is byte-identical to what a real static host would
   serve — only the hostname differs (localhost vs. a public domain). No
   external deploy occurs at any point.
2. **CI runs locally, not on GitHub Actions.** `.github/workflows/ci.yml` is
   written (mirrors `typecheck → lint → unit → fixtures → build → e2e:full`)
   but never executes remotely, because that would require a push to a
   remote this session cannot create. `pnpm run ci` is the actual verifier
   used throughout — every milestone's gate is this real local run, not an
   estimate.
3. **Build before e2e, not after.** SPEC.md §16 lists the CI order as
   `typecheck → lint → unit → fixtures → e2e:smoke → build`. This repo runs
   `build` before any Playwright check, because every e2e/smoke assertion
   here targets the real static export (see #1) — testing a dev server
   instead would not actually validate the zero-functions/static-export
   contract the later milestones depend on.

## API-surface additions (spec's inline TS sketches are illustrative, not exhaustive)

4. **`ChunkOptions.noteId?: string`** — `Chunk.noteId` is required by the
   data model (§2), but the spec's `chunkNote(text, opts)` sketch shows no
   note identity in `opts`. Added as optional (defaults to `"note"`) so
   `chunkNote` can actually produce spec-valid `Chunk` objects standalone.
5. **`ProjectionResult.components` / `.mean`** — Decision 3 requires
   "centroids projected onto the same axes" as the chunks that fitted them,
   but the spec's `project(embeddings): { coords, varianceExplained }`
   sketch exposes no reusable basis. Added `components` (the two fitted PC
   unit vectors) and `mean` (the centering vector) so a second, pure
   function (`projectOnto`, also new) can project centroids onto the exact
   same axes without refitting.
6. **`Embedder.countTokens(text): number`** — `core`'s `chunkNote` needs "the
   model's own tokenizer" (§3 Decision 2) via an injected `countTokens`
   callback, but §12's `Embedder` interface doesn't expose one. Added as a
   required method, backed by the real `AutoTokenizer` transformers.js loads
   alongside the pipeline — `core` still never imports a tokenizer directly;
   it's handed a function, same as the spec's own `chunkNote` design already
   assumes.

## Tooling choices not pinned by the spec

7. **TypeScript 5.9.3, not the current npm `latest` (7.0.2).** 7.x is the
   native (Go-based) rewrite; picked the newest well-established 5.x line
   instead to avoid rough edges in a from-scratch strict-mode build across
   Next.js/ESLint/Vitest tooling that targets the 5.x compiler API. Not a
   spec pin — SPEC.md doesn't name a TypeScript version — so this is a
   judgment call, not a deviation from a binding line.
8. **The Worker is pre-built by esbuild (`scripts/build-worker.mjs`), not
   bundled by Next.js's own compiler.** SPEC.md §11 says `src/worker/`
   should host model+core off the main thread; it doesn't mandate *how*
   the Worker gets bundled. The natural approach — `new Worker(new
   URL('./embedder.worker.ts', import.meta.url), { type: 'module' })` —
   turned out to be a real, currently-open gap in Next.js 16.3 combined
   with `output: 'export'`: because `useEmbedderWorker.ts` is a "use
   client" file that also gets compiled for the static export's
   server-side prerender pass ("Client Component SSR" in both bundlers'
   own build output), the worker file gets pulled into that *server*
   compilation graph too, even though the `new Worker(...)` call itself
   only ever runs client-side inside a `useEffect`. In that Node-context
   compilation, `@huggingface/transformers`'s package.json "node" export
   condition correctly-for-that-context resolves to
   `transformers.node.mjs`, which imports `onnxruntime-node`'s native
   `.node` binaries. Turbopack's build (the default) then silently falls
   back to copying the *raw, uncompiled* `.ts` source into
   `_next/static/media/` as an opaque asset — a browser cannot execute
   that. Forcing `next build --webpack` makes the failure loud instead of
   silent (`Module parse failed` on the native binary) but doesn't fix it.
   Root-caused, not a config typo — verified by testing both bundlers.
   Fix: `scripts/build-worker.mjs` compiles `embedder.worker.ts` to
   `apps/web/public/worker/embedder.worker.js` standalone via esbuild
   (`platform: 'browser'`, explicit `conditions: ['worker','browser',
   'import','default']`, so it always resolves transformers.js's browser
   build), wired into `pnpm run build` before `next build`. The main
   thread then does `new Worker("/worker/embedder.worker.js", { type:
   "module" })` — a plain string with no special meaning to Next.js's
   bundler, so it's never pulled into any Next.js compilation graph at
   all. Verified end-to-end in a real headless browser
   (`e2e/real-inference.spec.ts`): real model fetch over the network, real
   chunking, real embeddings.

## Fixture design correction (real measurement changed the plan mid-build)

9. **`thai-no-space` doesn't test what SPEC.md's one-line description
   literally implies, and now says so.** §14 states the fixture as "Thai
   paragraph, no spaces; chunk count > 1, every chunk ≤128 tokens" — read
   literally, that's a claim about the real default-model tokenizer's
   behavior on Thai. Building the fixture against real measurement (not
   assumption) found this claim is unreachable: the shipped default model
   (`Xenova/all-MiniLM-L6-v2`, English-only BERT/WordPiece) collapses *any*
   length of unspaced Thai text to exactly one `[UNK]` token — confirmed at
   20/65/458-grapheme lengths, all landing on 1 token, and confirmed
   model-specific (not "Thai is hard"): the same text against the
   multilingual model's SentencePiece tokenizer splits into 122 clean
   words. Cause: WordPiece pretokenizes on whitespace before subword
   matching; Thai has none, so the whole run is one "word," and BERT's
   vocabulary has ~no Thai coverage, so the greedy match fails immediately
   and the entire word becomes one `[UNK]` (standard WordPiece behavior on
   out-of-vocabulary input, not a bug in this codebase). Consequence: the
   fallback's real trigger condition, `countTokens(text) > 128`, can never
   be satisfied by organic Thai against this specific tokenizer — capped by
   vocabulary coverage, not content length, so no amount of lengthening the
   fixture text would ever reach it.

   Fix, not a workaround: `fixtures/linguistic/thai-no-space.json` now
   asserts three things instead of the original one — (a) the real,
   measured linguistic fact that stands regardless of tokenizer
   (`Intl.Segmenter` finds no sentence boundary anywhere in authentic
   unspaced/unpunctuated Thai — the actual "no boundary in a long run"
   condition), (b) the real tokenizer's count is pinned at exactly 1 token
   (so a future model swap that changes this is caught by a failing
   assertion, not silently missed), and (c) the chunking algorithm's
   fallback *mechanics* — multi-chunk, non-lossy, exact reconstruction,
   nothing flagged truncated — verified with a synthetic (grapheme-count)
   tokenizer decoupled from any one model's vocabulary limits, since that
   mechanical property is what SPEC.md's fallback exists to guarantee and
   is real to test even though the real default tokenizer can't trigger it
   here. `kind` changed from what would have been `"measured"` to
   `"structural"` to reflect that the fallback-mechanics half is now
   testing the algorithm, not this specific model's behavior.

   Caught by: dispatching the `computational-linguist` agent to author the
   CJK/Thai/Taglish fixture content (I am not fluent in any of the three),
   which ran the actual tokenizer in Node against draft text before
   handing it back rather than asserting fluency-based confidence. The CJK
   fixture's numbers (8 sentences, 206 tokens, 4 chunks) were verified
   independently against the real system and matched the agent's own
   hand-simulation exactly.

(Entries are appended milestone by milestone, not written in one pass — see
git log for exactly which commit introduced each one.)
