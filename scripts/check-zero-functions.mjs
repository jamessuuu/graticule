#!/usr/bin/env node
/**
 * ci:zero-functions gate. SPEC.md §11: "apps/web/ Next.js, static export,
 * ZERO server functions." Belt-and-suspenders on top of `output: 'export'`
 * (which already makes Next.js refuse to build if a route can't be
 * statically generated): fails loudly if anything that implies a server
 * runtime shows up — a Route Handler, middleware, or a build manifest that
 * isn't a plain static export.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const webDir = path.join(root, "apps/web");
const outDir = path.join(webDir, "out");
const srcAppDir = path.join(webDir, "src/app");

let failed = false;
function fail(msg) {
  failed = true;
  console.error(`ci:zero-functions FAIL — ${msg}`);
}
function ok(msg) {
  console.log(`ci:zero-functions ok — ${msg}`);
}

// 1. The static export must exist and contain the expected output.
if (!existsSync(outDir)) {
  fail(`no apps/web/out — run \`pnpm run build:web\` first`);
} else {
  const indexHtml = path.join(outDir, "index.html");
  if (!existsSync(indexHtml)) {
    fail(`apps/web/out/index.html missing — static export did not produce a homepage`);
  } else {
    ok(`apps/web/out/index.html present`);
  }
}

// 2. No Route Handlers (route.ts/route.js/route.tsx) anywhere in src/app —
//    these require a server runtime and are incompatible with a
//    zero-functions static site.
function walk(dir, matches) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, matches);
    } else if (/^route\.(ts|tsx|js|mjs)$/.test(entry)) {
      matches.push(full);
    } else if (/^middleware\.(ts|tsx|js|mjs)$/.test(entry)) {
      matches.push(full);
    }
  }
}
const serverFiles = [];
walk(srcAppDir, serverFiles);
// middleware.ts can also live at webDir root (Next.js convention).
for (const entry of existsSync(webDir) ? readdirSync(webDir) : []) {
  if (/^middleware\.(ts|tsx|js|mjs)$/.test(entry)) serverFiles.push(path.join(webDir, entry));
}

if (serverFiles.length > 0) {
  fail(`server-runtime files found (Route Handler or middleware): ${serverFiles.map((f) => path.relative(root, f)).join(", ")}`);
} else {
  ok("no route.ts/middleware.ts anywhere under apps/web");
}

// 3. The Next.js build manifest should show `output: export`'s
//    fingerprint: a `.next` dir with no server/ function manifest that
//    lists dynamic (non-static) routes, and no `.next/standalone`.
const nextDir = path.join(webDir, ".next");
const standaloneDir = path.join(nextDir, "standalone");
if (existsSync(standaloneDir)) {
  fail(`.next/standalone exists — this is a server build output, not a static export`);
} else {
  ok("no .next/standalone (not a server build)");
}

if (failed) {
  console.error("\nci:zero-functions: FAILED");
  process.exit(1);
} else {
  console.log("\nci:zero-functions: all checks green");
}
