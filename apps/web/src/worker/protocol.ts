/**
 * Message protocol between the main thread and embedder.worker.ts. Shared
 * so both sides stay in sync under `pnpm typecheck`. Float32Array survives
 * structured clone natively, so embeddings travel as-is (no manual
 * (de)serialization) — Chrome/Firefox/Safari all support cloning typed
 * arrays through postMessage.
 */
import type { Chunk } from "@graticule/core";

export interface WorkerLoadRequest {
  type: "load";
  variant: "default" | "multilingual";
}

export interface WorkerEmbedNoteRequest {
  type: "embedNote";
  noteId: string;
  text: string;
}

export interface WorkerEmbedTextsRequest {
  type: "embedTexts";
  requestId: string;
  texts: string[];
}

export type WorkerRequest = WorkerLoadRequest | WorkerEmbedNoteRequest | WorkerEmbedTextsRequest;

export interface WorkerLoadProgress {
  type: "loadProgress";
  variant: "default" | "multilingual";
  loaded: number;
  total: number;
}

export interface WorkerLoadDone {
  type: "loadDone";
  variant: "default" | "multilingual";
  modelId: string;
  sizeMB: number;
  cacheStatus: "cold" | "warm";
  languageCoverage: "en-only" | "multilingual-tuned-50";
}

export interface WorkerLoadError {
  type: "loadError";
  variant: "default" | "multilingual";
  message: string;
  /** Best-effort OOM/allocation-shape detection (SPEC.md §9/§13
   * "Allocation failure"). See embedder.worker.ts for the heuristic. */
  isAllocationFailure: boolean;
}

export interface WorkerEmbedNoteDone {
  type: "embedNoteDone";
  noteId: string;
  chunks: Chunk[];
  centroid: Float32Array;
}

export interface WorkerEmbedNoteError {
  type: "embedNoteError";
  noteId: string;
  message: string;
}

export interface WorkerEmbedTextsDone {
  type: "embedTextsDone";
  requestId: string;
  embeddings: Float32Array[];
}

/** SPEC.md §8: the live Network Receipt badge. The model/tokenizer/runtime
 * fetches happen inside this Worker (its own, separate resource-timing
 * timeline — a dedicated Worker's `PerformanceObserver` never surfaces on
 * `window.performance`, and vice versa), so the Worker has to report its
 * own real count back to the main thread rather than the page trying to
 * observe it directly. `total` is cumulative since the Worker started. */
export interface WorkerNetworkCount {
  type: "networkCount";
  total: number;
}

export type WorkerResponse =
  | WorkerLoadProgress
  | WorkerLoadDone
  | WorkerLoadError
  | WorkerEmbedNoteDone
  | WorkerEmbedNoteError
  | WorkerEmbedTextsDone
  | WorkerNetworkCount;
