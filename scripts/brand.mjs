#!/usr/bin/env node
/**
 * Deterministic brand glyph generator. SPEC.md §15 (Acceptance criteria,
 * Brand): "two horizontal and two vertical ink hairlines forming a
 * coordinate grid, with one plotted point deliberately OFF an
 * intersection, in AMBER — the amber signal is the projected point,
 * off-grid, because a projection is not a fixed coordinate."
 *
 * Pure string templating, zero dependencies, zero randomness, zero
 * timestamps in the output — running this twice produces byte-identical
 * files, which is the whole point of a *deterministic* brand script (the
 * same discipline chaff's manifest generation uses).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const INK = "#1A1A1A";
const PAPER = "#FAFAF7";
const AMBER = "#D97706";

// Grid geometry, fixed. Vertical lines at x=20,70; horizontal at y=30,75.
// The four intersections are (20,30) (20,75) (70,30) (70,75). The plotted
// point sits at (46,54) — deliberately off every intersection.
const V1 = 20;
const V2 = 70;
const H1 = 30;
const H2 = 75;
const POINT = { x: 46, y: 54, r: 7 };

function glyphSvg({ withBackground }) {
  const bg = withBackground ? `<rect width="100" height="100" fill="${PAPER}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="graticule mark: a coordinate grid with one plotted point off-intersection">
  <title>graticule</title>
${bg}
  <line x1="${V1}" y1="4" x2="${V1}" y2="96" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="${V2}" y1="4" x2="${V2}" y2="96" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="4" y1="${H1}" x2="96" y2="${H1}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="4" y1="${H2}" x2="96" y2="${H2}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="${POINT.x}" cy="${POINT.y}" r="${POINT.r}" fill="${AMBER}"/>
</svg>
`;
}

function wordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 64" role="img" aria-label="graticule">
  <title>graticule</title>
  <g transform="translate(0,0)">
    <line x1="10" y1="6" x2="10" y2="58" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <line x1="30" y1="6" x2="30" y2="58" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <line x1="2" y1="20" x2="38" y2="20" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <line x1="2" y1="42" x2="38" y2="42" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="22" cy="30" r="4" fill="${AMBER}"/>
  </g>
  <text x="52" y="42" font-family="ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace" font-size="30" fill="${INK}" letter-spacing="-0.5">graticule</text>
</svg>
`;
}

function writeIfChanged(targetPath, content) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) {
    const current = readFileSync(targetPath, "utf8");
    if (current === content) {
      console.log(`brand: unchanged ${path.relative(root, targetPath)}`);
      return;
    }
  }
  writeFileSync(targetPath, content, "utf8");
  console.log(`brand: wrote ${path.relative(root, targetPath)}`);
}

const glyphNoBg = glyphSvg({ withBackground: false });
const glyphWithBg = glyphSvg({ withBackground: true });
const wordmark = wordmarkSvg();

// Next.js App Router special file — auto-wired as the site favicon/icon.
writeIfChanged(path.join(root, "apps/web/src/app/icon.svg"), glyphWithBg);

// General-purpose brand assets referenced from the footer, README, etc.
writeIfChanged(path.join(root, "apps/web/public/brand/glyph.svg"), glyphNoBg);
writeIfChanged(path.join(root, "apps/web/public/brand/glyph-on-paper.svg"), glyphWithBg);
writeIfChanged(path.join(root, "apps/web/public/brand/wordmark.svg"), wordmark);

console.log("brand: done");
