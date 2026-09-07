"use client";

import { useMemo, useState } from "react";
import type { Note } from "@graticule/core";
import { fitProjectionToViewport, project, projectOnto, projectToViewportPixels } from "@graticule/core";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import instabilityReceipt from "../../../../fixtures/linguistic/pca-instability-on-edit.json";

const PROJECTION_DEBOUNCE_MS = 300;
export const MAP_VIEWPORT_SIZE = 600;
export const MAP_VIEWPORT_PADDING = 40;

/** Graticule lines, every 60 units of the 600-unit viewport. */
const GRID_LINES = [60, 120, 180, 240, 300, 360, 420, 480, 540];

export interface MapProps {
  notes: Note[];
  reducedMotion: boolean;
  selectedNoteId?: string | null;
  onSelectNote?: (noteId: string | null) => void;
}

export interface MapProjection {
  chunkCoords: Array<{ noteId: string; chunkId: string; x: number; y: number; truncated: boolean }>;
  noteCoords: Array<{ noteId: string; x: number; y: number }>;
  varianceExplainedPct: number;
}

/** SPEC.md §4 Decision 3: PCA over the full chunk matrix; centroids
 * projected onto the same axes. Recomputed whenever the note set changes
 * (the caller debounces at 300ms per the spec — see NoteWorkbench). */
export function computeProjection(notes: Note[]): MapProjection | null {
  const allChunks = notes.flatMap((n) => n.chunks);
  if (allChunks.length === 0) return null;

  const fitted = project(allChunks.map((c) => c.embedding));
  const chunkCoords = allChunks.map((c, i) => ({
    noteId: c.noteId,
    chunkId: c.id,
    x: fitted.coords[i]![0],
    y: fitted.coords[i]![1],
    truncated: c.truncated,
  }));

  const centroidCoords = projectOnto(fitted, notes.map((n) => n.centroid));
  const noteCoords = notes.map((n, i) => ({
    noteId: n.id,
    x: centroidCoords[i]![0],
    y: centroidCoords[i]![1],
  }));

  const varianceExplainedPct = Math.round((fitted.varianceExplained[0] + fitted.varianceExplained[1]) * 100);

  return { chunkCoords, noteCoords, varianceExplainedPct };
}

/** The live map. Chunks render smaller and lighter, note centroids larger
 * and solid — "the granularity must be legible on the map itself, not
 * only in a tooltip" (SPEC.md §3). `prefers-reduced-motion`: transitions
 * snap instead of tweening (§4). */
export function Map({ notes, reducedMotion, selectedNoteId, onSelectNote }: MapProps) {
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  // 300ms debounce per SPEC.md §4 Decision 3 — the note list/chunk counts
  // elsewhere on the page still update immediately; only the map's own
  // recompute (and its "N% of variation" receipt) lags briefly behind a
  // burst of add/remove/edit calls.
  const debouncedNotes = useDebouncedValue(notes, PROJECTION_DEBOUNCE_MS);
  const projection = useMemo(() => computeProjection(debouncedNotes), [debouncedNotes]);

  if (!projection) {
    return (
      <div className="map-empty" role="status">
        <p>Add a note to see the map.</p>
      </div>
    );
  }

  const fit = fitProjectionToViewport(
    [...projection.chunkCoords, ...projection.noteCoords],
    MAP_VIEWPORT_SIZE,
    MAP_VIEWPORT_PADDING
  );
  const toSvg = (x: number, y: number) => projectToViewportPixels({ x, y }, fit);
  const transitionStyle = reducedMotion ? { transition: "none" } : { transition: "cx 0.3s ease, cy 0.3s ease" };

  return (
    <figure className="map-figure">
      <svg
        viewBox={`0 0 ${MAP_VIEWPORT_SIZE} ${MAP_VIEWPORT_SIZE}`}
        role="img"
        aria-label={`Map of ${notes.length} notes, positioned by wording similarity. A text list of closest pairs is available below as the accessible equivalent.`}
        style={{ width: "100%", height: "auto", background: "var(--paper)", border: "1px solid var(--line-strong)" }}
      >
        {/* The grid the project is named for. Decorative: it carries no
            scale (the axes are PCA components, whose units mean nothing to
            a reader), so it is aria-hidden and drawn under everything. It
            exists to make the marks read as plotted rather than scattered. */}
        <g aria-hidden="true">
          {GRID_LINES.map((v) => (
            <line
              key={`gx-${v}`}
              x1={v}
              y1={0}
              x2={v}
              y2={MAP_VIEWPORT_SIZE}
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}
          {GRID_LINES.map((v) => (
            <line
              key={`gy-${v}`}
              x1={0}
              y1={v}
              x2={MAP_VIEWPORT_SIZE}
              y2={v}
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}
          <line
            x1={MAP_VIEWPORT_SIZE / 2}
            y1={0}
            x2={MAP_VIEWPORT_SIZE / 2}
            y2={MAP_VIEWPORT_SIZE}
            stroke="var(--line-strong)"
            strokeWidth={1}
            opacity={0.55}
          />
          <line
            x1={0}
            y1={MAP_VIEWPORT_SIZE / 2}
            x2={MAP_VIEWPORT_SIZE}
            y2={MAP_VIEWPORT_SIZE / 2}
            stroke="var(--line-strong)"
            strokeWidth={1}
            opacity={0.55}
          />
        </g>
        {projection.chunkCoords.map((c) => {
          const { x, y } = toSvg(c.x, c.y);
          return (
            <circle
              key={c.chunkId}
              cx={x}
              cy={y}
              r={3}
              fill={c.truncated ? "var(--amber)" : "var(--ink-3)"}
              opacity={0.55}
              style={transitionStyle}
            />
          );
        })}
        {projection.noteCoords.map((n) => {
          const { x, y } = toSvg(n.x, n.y);
          const isActive = n.noteId === selectedNoteId || n.noteId === hoveredNoteId;
          const select = () => onSelectNote?.(n.noteId === selectedNoteId ? null : n.noteId);
          return (
            <g key={n.noteId} data-testid="map-note-marker">
              {/* Invisible, larger hit target (SC 2.5.8: 24px minimum for
                  a pointer-operable control) — the visible dot below stays
                  its own smaller radius; this only exists to make it
                  actually clickable/tappable at a reasonable size. */}
              <circle cx={x} cy={y} r={12} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredNoteId(n.noteId)} onMouseLeave={() => setHoveredNoteId(null)} onClick={select} />
              {/* Mouse-only visual affordance, deliberately not exposed as
                  a keyboard/AT control: an interactive role nested inside
                  this svg's own role="img" is flattened out of the
                  accessibility tree by that ancestor role (verified during
                  the M7 accessibility pass) — DOM focus/tabIndex would
                  still work for a sighted keyboard user, but a screen-
                  reader user could never discover or operate it, so
                  claiming role="button" here was a false promise, not a
                  real affordance. Selecting a point only enlarges its own
                  dot (no other effect), so removing the fake keyboard path
                  loses nothing SessionAnalysis's text-list equivalent
                  doesn't already cover. */}
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={16}
                  fill="var(--amber)"
                  opacity={0.16}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 9 : 7}
                fill={isActive ? "var(--amber)" : "var(--mark)"}
                stroke="var(--paper)"
                strokeWidth={1.5}
                style={{ pointerEvents: "none", ...transitionStyle }}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="disclosure">
        This map places your notes by how similar their wording is, using a small language model that runs
        entirely in your browser — nothing you paste is sent anywhere. Position is relative to what you&apos;ve
        pasted and will shift as you add or remove notes; it is not a fixed or absolute measurement.
      </figcaption>
      <p className="receipt-row">
        <span>These two axes capture {projection.varianceExplainedPct}% of the variation.</span>
        <span>
          Adding one note moved existing points by an average of {Math.round(instabilityReceipt.expected.meanDisplacementPx)}
          px in a fixture measurement — position is not stable across edits.
        </span>
      </p>
    </figure>
  );
}
