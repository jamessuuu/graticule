#!/usr/bin/env node
/**
 * Standalone build for apps/web/src/worker/embedder.worker.ts, OUTSIDE of
 * Next.js's own bundler.
 *
 * Why: Next.js "use client" files (useEmbedderWorker.ts) also get compiled
 * for the server-side prerender pass of the static export ("Client
 * Component SSR" in both Turbopack's and webpack's own build output).
 * Since the worker is only ever *instantiated* inside a useEffect, that
 * code never actually runs on the server — but bundlers still need to
 * statically resolve `new Worker(new URL('./embedder.worker.ts',
 * import.meta.url))` at build time to know what to bundle, which pulls
 * embedder.worker.ts (and therefore @graticule/model and
 * @huggingface/transformers) into the SERVER/Node compilation graph too.
 * In that Node context, transformers.js's package.json "node" export
 * condition correctly-for-that-context resolves to
 * `transformers.node.mjs`, which imports `onnxruntime-node`'s native
 * `.node` binaries — binary files a JS bundler cannot parse. Turbopack
 * silently falls back to copying the raw, uncompiled .ts source as a
 * static asset instead (verified empirically); webpack fails the build
 * outright on the native binaries (also verified empirically). Both are
 * real, current gaps in Next.js 16.3's worker+static-export handling, not
 * a config typo.
 *
 * Fix: never let Next.js's bundler see `new Worker(new URL(...))` at all.
 * This script pre-compiles the worker into a plain, already-built ESM
 * file under `public/worker/`, targeting the browser explicitly (so
 * esbuild picks transformers.js's "browser"/"default" export condition,
 * never "node"). The runtime then references it by a plain string path —
 * `new Worker("/worker/embedder.worker.js", { type: "module" })` — which
 * has no special meaning to Next.js's bundler and is never touched by it.
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entry = path.join(root, "apps/web/src/worker/embedder.worker.ts");
const outdir = path.join(root, "apps/web/public/worker");
mkdirSync(outdir, { recursive: true });

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  // Explicit condition order so package.json "exports" maps resolve to
  // the browser build of every dependency (transformers.js in
  // particular) and never the "node" condition.
  conditions: ["worker", "browser", "import", "default"],
  outfile: path.join(outdir, "embedder.worker.js"),
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
};

if (watch) {
  const ctx = await (await import("esbuild")).context(options);
  await ctx.watch();
  console.log("build-worker: watching for changes...");
} else {
  await build(options);
  console.log("build-worker: wrote apps/web/public/worker/embedder.worker.js");
}
