"use client";

import { useMemo } from "react";
import type { Note } from "@graticule/core";
import { allPairwiseSimilarities, clusterNotes, outlierNote, percentile } from "@graticule/core";

function preview(text: string, maxLen = 70): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

function noteById(notes: Note[]): Map<string, Note> {
  return new Map(notes.map((n) => [n.id, n]));
}

/**
 * Pairwise percentile (§5, n>=5), deterministic clustering (§5 Decision
 * 4, n>=15), and outlier detection (§5, n>=3) — each floor-gated with an
 * inline "add N more notes" state, never a silently empty section (§13).
 *
 * This is also SPEC.md §15's accessible, non-visual equivalent to the
 * map: a plain text list of closest pairs, keyboard/screen-reader native.
 */
export function SessionAnalysis({ notes }: { notes: Note[] }) {
  const byId = useMemo(() => noteById(notes), [notes]);
  const centroids = useMemo(() => notes.map((n) => ({ id: n.id, embedding: n.centroid })), [notes]);

  const pairs = useMemo(() => allPairwiseSimilarities(centroids), [centroids]);
  const allSimilarities = useMemo(() => pairs.map((p) => p.similarity), [pairs]);

  const rankedPairs = useMemo(() => {
    return pairs
      .map((p) => ({ ...p, pct: percentile(p.similarity, allSimilarities) }))
      .sort((a, b) => b.similarity - a.similarity);
  }, [pairs, allSimilarities]);

  const clusters = useMemo(() => clusterNotes(centroids), [centroids]);
  const outlier = useMemo(() => outlierNote(centroids), [centroids]);

  return (
    <section aria-labelledby="analysis-heading" style={{ marginTop: "2rem" }}>
      <h2 id="analysis-heading" style={{ fontSize: "1.05rem" }}>
        How your notes relate
      </h2>

      {/* Pairwise percentile / closest pairs — the map's accessible text equivalent. */}
      <h3 style={{ fontSize: "0.95rem" }}>Closest pairs</h3>
      {notes.length < 5 ? (
        <p className="disclosure">Add {5 - notes.length} more note{5 - notes.length === 1 ? "" : "s"} to see pairwise comparisons.</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem" }}>
          {rankedPairs.map((p) => {
            const a = byId.get(p.a);
            const b = byId.get(p.b);
            if (!a || !b) return null;
            return (
              <li key={`${p.a}-${p.b}`} style={{ marginBottom: "0.35rem" }}>
                "{preview(a.text)}" and "{preview(b.text)}" — more similar than {Math.round(p.pct ?? 0)}% of the
                other pairs you pasted.
              </li>
            );
          })}
        </ul>
      )}

      {/* Clustering. */}
      <h3 style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>Groups</h3>
      {notes.length < 15 ? (
        <p className="disclosure">Add {15 - notes.length} more note{15 - notes.length === 1 ? "" : "s"} to see automatic groups.</p>
      ) : (
        <>
          <p className="disclosure">Notes grouped by similar wording (automatic, not reviewed).</p>
          <ol style={{ paddingLeft: "1.5rem" }}>
            {clusters?.map((cluster) => (
              <li key={cluster.id} style={{ marginBottom: "0.5rem" }}>
                <ul style={{ paddingLeft: "1.25rem" }}>
                  {cluster.memberNoteIds.map((id) => {
                    const note = byId.get(id);
                    return note ? <li key={id}>{preview(note.text)}</li> : null;
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Outlier. */}
      <h3 style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>Outlier</h3>
      {notes.length < 3 ? (
        <p className="disclosure">Add {3 - notes.length} more note{3 - notes.length === 1 ? "" : "s"} to see outlier detection.</p>
      ) : outlier ? (
        <p>
          "{preview(byId.get(outlier.id)?.text ?? "")}" —{" "}
          <span className="tag" style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>
            uses different wording than the rest
          </span>
        </p>
      ) : null}
    </section>
  );
}
