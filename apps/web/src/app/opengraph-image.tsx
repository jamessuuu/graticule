import { ImageResponse } from "next/og";

// Required for `output: "export"` — generates once at build time (no
// dynamic params on this route), not per-request.
export const dynamic = "force-static";
export const alt = "graticule — map your own notes, on-device";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// SPEC.md §15 (Brand, Build-time OG image): reuses the exact grid
// geometry/colors from scripts/brand.mjs's deterministic glyph generator
// (two horizontal + two vertical ink hairlines, one amber point
// deliberately off-intersection), rebuilt with plain positioned divs
// rather than raw <svg> — next/og's Satori renderer supports a much more
// reliable subset of that than inline SVG markup. Static export + no
// dynamic params, so this generates once at build time, not per-request.
const INK = "#1A1A1A";
const PAPER = "#FAFAF7";
const AMBER = "#B45309"; // the darkened, 4.5:1-on-paper amber (globals.css), not the brighter brand hex

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          fontFamily: "monospace",
        }}
      >
        {/* Grid + off-intersection amber point, same geometry as the brand glyph */}
        <div style={{ position: "relative", width: 260, height: 260, display: "flex", marginRight: 64 }}>
          <div style={{ position: "absolute", left: 52, top: 10, width: 5, height: 240, background: INK, borderRadius: 3 }} />
          <div style={{ position: "absolute", left: 182, top: 10, width: 5, height: 240, background: INK, borderRadius: 3 }} />
          <div style={{ position: "absolute", left: 10, top: 78, width: 240, height: 5, background: INK, borderRadius: 3 }} />
          <div style={{ position: "absolute", left: 10, top: 195, width: 240, height: 5, background: INK, borderRadius: 3 }} />
          <div
            style={{
              position: "absolute",
              left: 118,
              top: 138,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: AMBER,
              display: "flex",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 88, color: INK, fontWeight: 700, letterSpacing: -2, display: "flex" }}>graticule</div>
          <div style={{ fontSize: 30, color: INK, marginTop: 18, lineHeight: 1.35, display: "flex" }}>
            Map your own notes, on-device.
          </div>
          <div style={{ fontSize: 22, color: "#4B4B46", marginTop: 20, lineHeight: 1.4, display: "flex" }}>
            Nothing you paste ever leaves the tab.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
