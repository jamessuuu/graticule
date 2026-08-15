"use client";

import { useEffect, useRef } from "react";
import type { EmbedderState } from "./useEmbedderWorker";
import type { AddNoteResult } from "./useNotesSession";
import sampleCorpus from "../../../../fixtures/sample-corpus.json";

/**
 * SPEC.md §7 / §12: "hero is the live map preloaded with the sample
 * corpus" — "so a visitor with nothing to paste sees the map, the groups
 * and the outlier flag inside ten seconds." Fires once, only on a
 * genuinely fresh session (zero notes) the first time the default model
 * becomes ready — never re-fires after a visitor clears everything back
 * to zero, which would be a surprising "I cleared it and it came back."
 * Each sample note goes through the exact same `addNote` path a pasted
 * note does (real chunking, real embedding, source: "sample"), so the
 * existing "embedding N notes…" status line already covers this without
 * a second, competing loading message.
 */
export function useSampleCorpusPreload(
  embedderState: EmbedderState,
  noteCount: number,
  addNote: (text: string, source?: "sample" | "visitor") => Promise<AddNoteResult>
) {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (embedderState.status !== "ready") return;
    triggered.current = true;
    // A visitor could in principle already have real notes by the time
    // this first sees "ready" (a very fast paste racing idle-load) —
    // never stomp on real content with samples.
    if (noteCount > 0) return;

    let cancelled = false;
    (async () => {
      for (const note of sampleCorpus.notes) {
        if (cancelled) return;
        await addNote(note.text, "sample");
      }
    })();
    return () => {
      cancelled = true;
    };
    // addNote is a stable useCallback from useNotesSession; noteCount is
    // only read once, at trigger time, via the closure guard above — not
    // a re-trigger dependency (re-adding samples after a visitor removes
    // them would defeat "Clear samples").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedderState.status]);
}
