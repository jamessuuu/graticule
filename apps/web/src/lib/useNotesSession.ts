"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note, NoteSource } from "@graticule/core";
import { checkCaps, isDuplicateText } from "@graticule/core";
import { useEmbedderWorker } from "./useEmbedderWorker";
import type { ModelVariant } from "./useEmbedderWorker";

function makeNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type AddNoteResult =
  | { status: "added"; note: Note }
  | { status: "empty" }
  | { status: "duplicate" }
  | { status: "capped"; reason: "notes" | "characters" };

export type EditNoteResult = { status: "edited" } | { status: "empty" } | { status: "duplicate" } | { status: "not-found" };

/**
 * Owns the session's notes (Decision 9: session-only, in-memory, no
 * persistence). SPEC.md §7: "Every add/edit/remove re-chunks, re-embeds
 * only the changed note." §7 caps (200 notes / 200,000 characters,
 * clear refusal). §7 dedupe (exact match after NFC, toast not a silent
 * duplicate).
 *
 * Uses a ref mirror of `notes` alongside the state so add/edit can
 * synchronously check caps/dedupe against the latest set even though a
 * React state update from a moment ago may not have flushed to the
 * `notes` closure yet.
 */
export function useNotesSession() {
  const { state: embedderState, load, embedNote, embedTexts, workerNetworkRequests } = useEmbedderWorker();
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [reembedding, setReembedding] = useState(false);
  const pendingSwitch = useRef(false);

  const setNotesBoth = useCallback((updater: (prev: Note[]) => Note[]) => {
    setNotes((prev) => {
      const next = updater(prev);
      notesRef.current = next;
      return next;
    });
  }, []);

  const addNote = useCallback(
    async (text: string, source: NoteSource = "visitor"): Promise<AddNoteResult> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return { status: "empty" };

      const current = notesRef.current;
      if (isDuplicateText(trimmed, current.map((n) => n.text))) {
        return { status: "duplicate" };
      }
      const capResult = checkCaps(
        { noteCount: current.length, totalCharacters: current.reduce((s, n) => s + n.text.length, 0) },
        trimmed
      );
      if (!capResult.allowed) {
        return { status: "capped", reason: capResult.reason };
      }

      const id = makeNoteId();
      setPendingIds((p) => new Set(p).add(id));
      try {
        const { chunks, centroid } = await embedNote(id, trimmed);
        const note: Note = { id, text: trimmed, source, createdAt: Date.now(), chunks, centroid };
        setNotesBoth((ns) => [...ns, note]);
        return { status: "added", note };
      } finally {
        setPendingIds((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    },
    [embedNote, setNotesBoth]
  );

  const editNote = useCallback(
    async (noteId: string, newText: string): Promise<EditNoteResult> => {
      const trimmed = newText.trim();
      if (trimmed.length === 0) return { status: "empty" };

      const current = notesRef.current;
      const existing = current.find((n) => n.id === noteId);
      if (!existing) return { status: "not-found" };

      const others = current.filter((n) => n.id !== noteId).map((n) => n.text);
      if (isDuplicateText(trimmed, others)) {
        return { status: "duplicate" };
      }

      setPendingIds((p) => new Set(p).add(noteId));
      try {
        const { chunks, centroid } = await embedNote(noteId, trimmed);
        setNotesBoth((ns) => ns.map((n) => (n.id === noteId ? { ...n, text: trimmed, chunks, centroid } : n)));
        return { status: "edited" };
      } finally {
        setPendingIds((p) => {
          const next = new Set(p);
          next.delete(noteId);
          return next;
        });
      }
    },
    [embedNote, setNotesBoth]
  );

  const removeNote = useCallback(
    (noteId: string) => {
      setNotesBoth((ns) => ns.filter((n) => n.id !== noteId));
    },
    [setNotesBoth]
  );

  const clearSamples = useCallback(() => {
    setNotesBoth((ns) => ns.filter((n) => n.source !== "sample"));
  }, [setNotesBoth]);

  /** SPEC.md §9: "Switching mid-session re-embeds every chunk... because
   * the embedding space itself changed, not just the note set." Token
   * budgets (§3 Decision 2) are also counted by the *active* model's own
   * tokenizer, so a model switch re-chunks too, not just re-embeds. */
  const switchModel = useCallback(
    (variant: ModelVariant) => {
      pendingSwitch.current = true;
      load(variant);
    },
    [load]
  );

  useEffect(() => {
    if (!pendingSwitch.current) return;
    if (embedderState.status !== "ready") return;
    pendingSwitch.current = false;

    const current = notesRef.current;
    if (current.length === 0) return;

    let cancelled = false;
    setReembedding(true);
    (async () => {
      const updated: Note[] = [];
      for (const note of current) {
        if (cancelled) return;
        const { chunks, centroid } = await embedNote(note.id, note.text);
        updated.push({ ...note, chunks, centroid });
      }
      if (!cancelled) {
        setNotesBoth(() => updated);
        setReembedding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // embedNote/setNotesBoth are stable useCallbacks; embedderState.status
    // is the real trigger for "the newly-chosen model just became ready."
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedderState.status]);

  return {
    embedderState,
    load,
    switchModel,
    reembedding,
    notes,
    addNote,
    editNote,
    removeNote,
    clearSamples,
    pendingIds,
    embedTexts,
    workerNetworkRequests,
  };
}
