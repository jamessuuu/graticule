#!/usr/bin/env node
/**
 * Minimal static file server for `apps/web/out` — the static export
 * produced by `next build` with `output: 'export'`.
 *
 * Stands in for "the deployed site" throughout this build: the project's
 * hard operating rules forbid any external deploy (no Vercel/Cloudflare
 * push, no new remotes) from this session, so every SPEC.md check that
 * says "verified against the deployed site" is run here instead, against
 * the real static export artifact served over plain HTTP — same bytes a
 * real static host would serve, same zero-server-functions guarantee,
 * just localhost instead of a public URL. See docs/DEVIATIONS.md.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "apps/web/out");

const PORT = Number(process.env.PORT ?? process.argv[2] ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  let rel = decoded === "/" ? "/index.html" : decoded;

  const candidates = [
    path.join(outDir, rel),
    path.join(outDir, rel, "index.html"),
    path.join(outDir, `${rel}.html`),
    path.join(outDir, "404.html"),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(path.resolve(outDir))) continue; // no traversal
    try {
      const s = await stat(resolved);
      if (s.isFile()) return resolved;
    } catch {
      // try next candidate
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url ?? "/");
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(file);
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`Internal error: ${String(err)}`);
  }
});

server.listen(PORT, () => {
  console.log(`serve-static: http://localhost:${PORT} -> apps/web/out`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
