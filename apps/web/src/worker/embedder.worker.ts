/**
 * Hosts the model (packages/model) and core (packages/core) off the main
 * thread. SPEC.md §11: "src/worker/ hosts model + core off the main
 * thread (chaff's Worker isolation)." Never on the main thread — so
 * embedding a note never blocks typing/scrolling.
 *
 * NOT bundled by Next.js. `scripts/build-worker.mjs` compiles this file
 * standalone with esbuild into `public/worker/embedder.worker.js`
 * (browser target, so transformers.js resolves its browser build); the
 * main thread loads that compiled output by a plain string path
 * (`useEmbedderWorker.ts`). See that script's header comment for why:
 * Next.js's own bundler (both Turbopack and webpack, verified) mishandles
 * `new Worker(new URL(...))` combined with `output: 'export'` here.
 */
/// <reference lib="webworker" />
import { centroid, chunkNote } from "@graticule/core";
import type { Embedder } from "@graticule/model";
import { createDefaultEmbedder, createMultilingualEmbedder } from "@graticule/model";
import type { WorkerRequest, WorkerResponse } from "./protocol";

// SPEC.md §3 Decision 2.
const CHUNK_OPTIONS = { maxTokens: 80, maxSentences: 3, hardCeiling: 128 } as const;

let embedder: Embedder | null = null;
let embedderVariant: "default" | "multilingual" | null = null;

function post(message: WorkerResponse): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

/** Best-effort OOM/allocation-shape detection (SPEC.md §9/§13). ONNX
 * Runtime / WASM allocation failures surface as varied, backend-specific
 * error shapes (RangeError from a failed `new WebAssembly.Memory`,
 * "Aborted()" from emscripten's abort handler, or a message mentioning
 * allocation/memory directly) — there's no single typed exception to
 * catch, so this inspects the message text for the known shapes. */
function looksLikeAllocationFailure(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("out of memory") ||
    lower.includes("allocation failed") ||
    lower.includes("memory access out of bounds") ||
    lower.includes("aborted(") ||
    error instanceof RangeError
  );
}

async function handleLoad(variant: "default" | "multilingual"): Promise<void> {
  const next = variant === "default" ? createDefaultEmbedder() : createMultilingualEmbedder();
  try {
    await next.load((loaded, total) => {
      post({ type: "loadProgress", variant, loaded, total });
    });
    embedder = next;
    embedderVariant = variant;
    post({
      type: "loadDone",
      variant,
      modelId: next.modelId,
      sizeMB: next.sizeMB,
      cacheStatus: await next.cacheStatus(),
      languageCoverage: next.languageCoverage,
    });
  } catch (error) {
    post({
      type: "loadError",
      variant,
      message: error instanceof Error ? error.message : String(error),
      isAllocationFailure: looksLikeAllocationFailure(error),
    });
  }
}

async function handleEmbedNote(noteId: string, text: string): Promise<void> {
  if (!embedder) {
    post({ type: "embedNoteError", noteId, message: "No embedder loaded yet." });
    return;
  }
  try {
    const chunks = chunkNote(text, {
      ...CHUNK_OPTIONS,
      countTokens: (t) => embedder!.countTokens(t),
      noteId,
    });
    if (chunks.length === 0) {
      post({ type: "embedNoteDone", noteId, chunks: [], centroid: new Float32Array(0) });
      return;
    }
    const embeddings = await embedder.embed(chunks.map((c) => c.text));
    const embeddedChunks = chunks.map((c, i) => ({ ...c, embedding: embeddings[i]! }));
    post({
      type: "embedNoteDone",
      noteId,
      chunks: embeddedChunks,
      centroid: centroid(embeddings),
    });
  } catch (error) {
    post({ type: "embedNoteError", noteId, message: error instanceof Error ? error.message : String(error) });
  }
}

async function handleEmbedTexts(requestId: string, texts: string[]): Promise<void> {
  if (!embedder) {
    // The negation demo (/limits) and other direct-text callers should
    // not normally reach this — the caller is expected to await
    // `loadDone` first. Fail loudly rather than silently returning
    // nothing.
    throw new Error("embedTexts requested before any embedder was loaded");
  }
  const embeddings = await embedder.embed(texts);
  post({ type: "embedTextsDone", requestId, embeddings });
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case "load":
      void handleLoad(msg.variant);
      break;
    case "embedNote":
      void handleEmbedNote(msg.noteId, msg.text);
      break;
    case "embedTexts":
      void handleEmbedTexts(msg.requestId, msg.texts);
      break;
  }
});

// Exposed for the `embedderVariant` read in tests / debugging only; not
// part of the message protocol.
export type { WorkerRequest, WorkerResponse } from "./protocol";
export const __debug = { getVariant: () => embedderVariant };
