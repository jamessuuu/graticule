"use client";

import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";
import { MAX_NOTES, MAX_TOTAL_CHARACTERS } from "@graticule/core";
import { ModelLifecycle } from "./ModelLifecycle";
import { ModelUpgrade } from "./ModelUpgrade";
import { NetworkReceipt } from "./NetworkReceipt";
import { Map } from "./Map";
import { ToastStack } from "./ToastStack";
import { SearchBox } from "./SearchBox";
import { SessionAnalysis } from "./SessionAnalysis";
import { useNotesSession } from "@/lib/useNotesSession";
import { useToasts } from "@/lib/useToasts";
import { useFileImport } from "@/lib/useFileImport";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useSampleCorpusPreload } from "@/lib/useSampleCorpusPreload";
import type { Note } from "@graticule/core";

function capMessage(reason: "notes" | "characters"): string {
  return reason === "notes"
    ? `That would be more than ${MAX_NOTES} notes in one session — this tool works on a set you can actually look at, not an archive.`
    : `That would be more than ${MAX_TOTAL_CHARACTERS.toLocaleString()} characters in one session. Try a smaller set of notes.`;
}

function NoteRow({
  note,
  onRemove,
  onEditSubmit,
}: {
  note: Note;
  onRemove: (id: string) => void;
  onEditSubmit: (id: string, text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [saving, setSaving] = useState(false);
  const hasTruncated = note.chunks.some((c) => c.truncated);

  if (editing) {
    return (
      <li style={{ borderTop: "1px solid var(--line)", padding: "0.75rem 0" }}>
        <textarea
          aria-label="Edit note text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--line-strong)", borderRadius: 2 }}
        />
        <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onEditSubmit(note.id, draft);
              setSaving(false);
              setEditing(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(note.text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li style={{ borderTop: "1px solid var(--line)", padding: "0.75rem 0" }}>
      <p style={{ margin: 0 }}>
        {note.source === "sample" && <span className="tag tag-sample" style={{ marginRight: "0.5rem" }}>sample</span>}
        {note.text}
      </p>
      <p className="receipt-row" style={{ marginTop: "0.35rem", alignItems: "center" }}>
        <span>
          {note.chunks.length} chunk{note.chunks.length === 1 ? "" : "s"} ·{" "}
          {note.chunks.reduce((s, c) => s + c.tokenCount, 0)} tokens
        </span>
        {hasTruncated ? (
          <span className="tag tag-truncated">only the part shown here was read by the model</span>
        ) : null}
        <button type="button" onClick={() => setEditing(true)} style={{ marginLeft: "auto" }}>
          Edit
        </button>
        <button type="button" onClick={() => onRemove(note.id)}>
          Remove
        </button>
      </p>
    </li>
  );
}

export function NoteWorkbench() {
  const {
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
  } = useNotesSession();
  const { toasts, pushToast, dismissToast } = useToasts();
  const { importFromDrop, importFromFileList, pickFolder, supportsFileSystemAccess } = useFileImport();
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useSampleCorpusPreload(embedderState, notes.length, addNote);

  const canSubmit = embedderState.status === "ready" && draft.trim().length > 0 && !submitting;

  const submitNote = useCallback(
    async (text: string, source: "sample" | "visitor" = "visitor") => {
      const result = await addNote(text, source);
      if (result.status === "duplicate") {
        pushToast("That note (or the same text differently encoded) is already in this session.");
      } else if (result.status === "capped") {
        pushToast(capMessage(result.reason));
      }
      return result;
    },
    [addNote, pushToast]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const submittedText = draft;
    setSubmitting(true);
    try {
      const result = await submitNote(submittedText);
      if (result.status === "added") {
        // Only clear if the draft still holds what we just submitted —
        // a functional update reads the *current* state, not the stale
        // closure, so it doesn't clobber text the visitor started typing
        // while this submission's embed was still in flight (a real race
        // caught by e2e testing, not a hypothetical).
        setDraft((current) => (current === submittedText ? "" : current));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const importFiles = useCallback(
    async (files: { name: string; text: string }[]) => {
      for (const f of files) {
        if (f.text.trim().length === 0) continue;
        await submitNote(f.text);
      }
    },
    [submitNote]
  );

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (embedderState.status !== "ready") return;
    const files = await importFromDrop(e.dataTransfer);
    await importFiles(files);
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = await importFromFileList(e.target.files);
    await importFiles(files);
    e.target.value = "";
  }

  async function handleFolderPick() {
    // Modern path: the File System Access API's real directory picker.
    const files = await pickFolder();
    if (files) {
      await importFiles(files);
      return;
    }
    // Older-browser fallback: an <input> dedicated to directory selection
    // (chaff's proven pattern) — kept as a SEPARATE input from "Choose
    // files" below, because `webkitdirectory` forces the native dialog
    // into folder-only mode unconditionally; sharing one input would
    // silently break plain multi-file selection too.
    folderInputRef.current?.click();
  }

  const hasSamples = notes.some((n) => n.source === "sample");

  return (
    <div>
      {/* Order matters here. The map used to sit under three stacked status
          blocks including a 140MB download offer, so the first screen was
          entirely about the page rather than about the visitor's notes. The
          map now comes first and the model status reads as an instrument
          strip beneath it; the optional multilingual upgrade moved down to
          sit with the note list it re-embeds. */}
      <div className="workbench rise rise-2">
        <div>
          <Map notes={notes} reducedMotion={reducedMotion} selectedNoteId={selectedNoteId} onSelectNote={setSelectedNoteId} />

          <div className="status-strip">
            <ModelLifecycle embedderState={embedderState} load={load} />
            <NetworkReceipt workerNetworkRequests={workerNetworkRequests} modelReady={embedderState.status === "ready"} />
          </div>
        </div>

      <form onSubmit={handleSubmit} className="panel note-form">
        <label htmlFor="note-draft" style={{ display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
          Add a note
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          style={{
            border: `1px dashed ${dragActive ? "var(--amber)" : "var(--line-strong)"}`,
            borderRadius: 2,
            padding: dragActive ? "0" : "0",
            background: dragActive ? "var(--amber-bg)" : "transparent",
          }}
        >
          <textarea
            id="note-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "0.6rem", border: "none", background: "transparent", display: "block" }}
            placeholder="Paste or type a short note, or drop a .txt/.md file or folder…"
            disabled={embedderState.status !== "ready"}
          />
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? "Embedding…" : "Add note"}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={embedderState.status !== "ready"}>
            Choose files
          </button>
          <button type="button" onClick={handleFolderPick} disabled={embedderState.status !== "ready"}>
            Choose folder
          </button>
          {hasSamples && (
            <button type="button" onClick={clearSamples}>
              Clear samples
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown"
            onChange={handleFileInputChange}
            style={{ display: "none" }}
          />
          {!supportsFileSystemAccess && (
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-expect-error — non-standard but broadly supported folder-select attribute (chaff's fallback pattern); forces the native dialog into folder-only mode, so this input is never shared with "Choose files"
              webkitdirectory=""
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />
          )}
        </div>
      </form>

      {pendingIds.size > 0 && (
          <p className="receipt-row" role="status">
            embedding {pendingIds.size} note{pendingIds.size === 1 ? "" : "s"}…
          </p>
        )}
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} onRemove={removeNote} onEditSubmit={async (id, text) => {
            const result = await editNote(id, text);
            if (result.status === "duplicate") {
              pushToast("That text matches another note already in this session.");
            }
          }} />
        ))}
      </ul>

      <ModelUpgrade embedderState={embedderState} switchModel={switchModel} reembedding={reembedding} noteCount={notes.length} />

      <SearchBox notes={notes} embedTexts={embedTexts} ready={embedderState.status === "ready"} />
      <SessionAnalysis notes={notes} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
