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

(Entries are appended milestone by milestone, not written in one pass — see
git log for exactly which commit introduced each one.)
