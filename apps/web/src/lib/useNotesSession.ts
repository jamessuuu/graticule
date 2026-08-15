"use client";

import { useCallback, useState } from "react";
import type { Note, NoteSource } from "@graticule/core";
import { useEmbedderWorker } from "./useEmbedderWorker";

function makeNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns the session's notes (Decision 9: session-only, in-memory, no
 * persistence). M1 lands add-only; M2 adds NFC dedupe, caps, edit/remove.
 */
export function useNotesSession() {
  const { state: embedderState, load, embedNote, embedTexts } = useEmbedderWorker();
  const [notes, setNotes] = useState<Note[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const addNote = useCallback(
    async (text: string, source: NoteSource = "visitor"): Promise<Note | null> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return null;

      const id = makeNoteId();
      setPendingIds((p) => new Set(p).add(id));
      try {
        const { chunks, centroid } = await embedNote(id, trimmed);
        const note: Note = { id, text: trimmed, source, createdAt: Date.now(), chunks, centroid };
        setNotes((ns) => [...ns, note]);
        return note;
      } finally {
        setPendingIds((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    },
    [embedNote]
  );

  return { embedderState, load, notes, addNote, pendingIds, embedTexts };
}
