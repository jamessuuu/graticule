"use client";

import { useState } from "react";
import type { Note } from "@graticule/core";
import { rankBySimilarity } from "@graticule/core";

export interface SearchBoxProps {
  notes: Note[];
  embedTexts: (texts: string[]) => Promise<Float32Array[]>;
  ready: boolean;
}

interface RankedChunkResult {
  rank: number;
  noteId: string;
  noteText: string;
  chunkText: string;
  truncated: boolean;
}

/**
 * SPEC.md §5: "Search: an ordered list, no score." Ranks over chunks
 * (fine-grained recall, Decision 1) but displays each result's parent
 * note for context. Also SPEC.md §15's accessible alternative to the map:
 * this is a plain text list, keyboard-and-screen-reader native.
 */
export function SearchBox({ notes, embedTexts, ready }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankedChunkResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const allChunks = notes.flatMap((n) => n.chunks.map((c) => ({ ...c, noteText: n.text })));

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !ready || allChunks.length === 0) return;
    setSearching(true);
    try {
      const [queryEmbedding] = await embedTexts([trimmed]);
      const ranked = rankBySimilarity(
        queryEmbedding!,
        allChunks.map((c) => ({ id: c.id, embedding: c.embedding }))
      );
      const byId = new Map(allChunks.map((c) => [c.id, c]));
      const withContext: RankedChunkResult[] = ranked.map((r) => {
        const chunk = byId.get(r.id)!;
        return {
          rank: r.rank,
          noteId: chunk.noteId,
          noteText: chunk.noteText,
          chunkText: chunk.text,
          truncated: chunk.truncated,
        };
      });
      setResults(withContext);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section aria-labelledby="search-heading" style={{ marginTop: "2rem" }}>
      <h2 id="search-heading" style={{ fontSize: "1.05rem" }}>
        Search by meaning
      </h2>
      <form onSubmit={handleSearch}>
        <label htmlFor="search-query" style={{ display: "block", marginBottom: "0.35rem" }}>
          Find notes closest in meaning to
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="search-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!ready || notes.length === 0}
            placeholder="Type a phrase…"
            style={{ flex: 1, padding: "0.5rem", border: "1px solid var(--line-strong)", borderRadius: 2 }}
          />
          <button type="submit" disabled={!ready || !query.trim() || notes.length === 0 || searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
      </form>
      <p className="disclosure" style={{ marginTop: "0.5rem" }}>
        Ranked by similarity in wording/meaning — may not distinguish a statement from its opposite.
      </p>

      {results && (
        <ol style={{ marginTop: "1rem", paddingLeft: "1.5rem" }}>
          {results.map((r) => (
            <li key={`${r.noteId}-${r.rank}`} style={{ marginBottom: "0.5rem" }}>
              {r.noteText}
              {r.truncated ? (
                <span className="tag tag-truncated" style={{ marginLeft: "0.5rem" }}>
                  only the part shown here was read by the model
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
