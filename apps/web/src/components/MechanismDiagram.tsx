/**
 * SPEC.md §15 (Accessibility): "The mechanism diagram (chunk → embed →
 * project, with the recompute arrow in amber because that edge is the
 * honesty argument) carries a real <title>/<desc>." The amber edge is not
 * decoration — it is the diagram's actual point: every add/edit/remove
 * runs the whole pipeline again, which is why the map's position is
 * relative and not a fixed coordinate (the same claim the persistent
 * disclosure beside the live map makes in words).
 */
export function MechanismDiagram() {
  return (
    <svg
      viewBox="0 0 640 220"
      role="img"
      aria-labelledby="mechanism-title mechanism-desc"
      style={{ width: "100%", maxWidth: "640px", height: "auto" }}
    >
      <title id="mechanism-title">How a note becomes a point on the map</title>
      <desc id="mechanism-desc">
        A flow diagram with three stages in a row: chunk, embed, project. An arrow leads from chunk to
        embed, and another from embed to project. A fourth, curved arrow in amber leads from project back
        to chunk, labelled &quot;recompute on every add, edit, or remove&quot; — showing that the whole
        pipeline reruns on every change, which is why a note&apos;s position on the map is relative to the
        current set of notes, not a fixed coordinate.
      </desc>

      <defs>
        <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--amber)" />
        </marker>
      </defs>

      {/* Nodes */}
      <g>
        <rect x="20" y="50" width="140" height="60" rx="4" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <text x="90" y="85" textAnchor="middle" fontSize="18" fill="var(--ink)">
          chunk
        </text>
      </g>
      <g>
        <rect x="250" y="50" width="140" height="60" rx="4" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <text x="320" y="85" textAnchor="middle" fontSize="18" fill="var(--ink)">
          embed
        </text>
      </g>
      <g>
        <rect x="480" y="50" width="140" height="60" rx="4" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <text x="550" y="85" textAnchor="middle" fontSize="18" fill="var(--ink)">
          project
        </text>
      </g>

      {/* Forward flow */}
      <line x1="160" y1="80" x2="246" y2="80" stroke="var(--line-strong)" strokeWidth="2" markerEnd="url(#arrow-ink)" />
      <line x1="390" y1="80" x2="476" y2="80" stroke="var(--line-strong)" strokeWidth="2" markerEnd="url(#arrow-ink)" />

      {/* Recompute edge — the honesty argument, in amber */}
      <path
        d="M 550 112 C 550 190, 90 190, 90 114"
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2.5"
        markerEnd="url(#arrow-amber)"
      />
      <text x="320" y="205" textAnchor="middle" fontSize="14" fill="var(--amber)">
        recompute on every add, edit, or remove
      </text>
    </svg>
  );
}
