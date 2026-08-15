"use client";

import { useState } from "react";
import { ModelLifecycle } from "./ModelLifecycle";
import { useNotesSession } from "@/lib/useNotesSession";

/**
 * M1 foundation: add a note, chunk + embed it for real in the Worker, see
 * the resulting chunks. M2 adds the PCA map, paste/drop, NFC dedupe,
 * truncation-flag display, and session caps on top of this same
 * `useNotesSession` state.
 */
export function NoteWorkbench() {
  const { embedderState, load, notes, addNote, pendingIds } = useNotesSession();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = embedderState.status === "ready" && draft.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await addNote(draft, "visitor");
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <ModelLifecycle embedderState={embedderState} load={load} />

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label htmlFor="note-draft" style={{ display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
          Add a note
        </label>
        <textarea
          id="note-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--line-strong)", borderRadius: 2 }}
          placeholder="Paste or type a short note…"
          disabled={embedderState.status !== "ready"}
        />
        <button type="submit" disabled={!canSubmit} style={{ marginTop: "0.5rem" }}>
          {submitting ? "Embedding…" : "Add note"}
        </button>
      </form>

      {pendingIds.size > 0 && (
        <p className="receipt-row" role="status">
          embedding {pendingIds.size} note{pendingIds.size === 1 ? "" : "s"}…
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        {notes.map((note) => (
          <li key={note.id} style={{ borderTop: "1px solid var(--line)", padding: "0.75rem 0" }}>
            <p style={{ margin: 0 }}>{note.text}</p>
            <p className="receipt-row" style={{ marginTop: "0.35rem" }}>
              {note.chunks.length} chunk{note.chunks.length === 1 ? "" : "s"} · {note.chunks.reduce((s, c) => s + c.tokenCount, 0)}{" "}
              tokens
              {note.chunks.some((c) => c.truncated) ? (
                <span className="tag tag-truncated" style={{ marginLeft: "0.5rem" }}>
                  only the part shown here was read by the model
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
