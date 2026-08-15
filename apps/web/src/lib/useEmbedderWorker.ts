"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chunk } from "@graticule/core";
import type { WorkerRequest, WorkerResponse } from "@/worker/protocol";

export type ModelVariant = "default" | "multilingual";

export interface ModelInfo {
  modelId: string;
  sizeMB: number;
  cacheStatus: "cold" | "warm";
  languageCoverage: "en-only" | "multilingual-tuned-50";
}

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface EmbedderState {
  status: LoadStatus;
  variant: ModelVariant | null;
  progress: { loaded: number; total: number } | null;
  modelInfo: ModelInfo | null;
  error: string | null;
  isAllocationFailure: boolean;
}

const initialState: EmbedderState = {
  status: "idle",
  variant: null,
  progress: null,
  modelInfo: null,
  error: null,
  isAllocationFailure: false,
};

/** Owns the embedder Worker's lifecycle and turns its postMessage protocol
 * into promise-returning calls + React state. One Worker per page load. */
export function useEmbedderWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<EmbedderState>(initialState);
  // SPEC.md §8's Network Receipt: cumulative resource-timing entries the
  // Worker itself has observed (the model/tokenizer/runtime fetches — see
  // embedder.worker.ts for why this can only be counted there). Kept
  // separate from EmbedderState, which is about model lifecycle, not
  // network counting.
  const [workerNetworkRequests, setWorkerNetworkRequests] = useState(0);

  const noteResolvers = useRef(
    new Map<string, { resolve: (v: { chunks: Chunk[]; centroid: Float32Array }) => void; reject: (e: Error) => void }>()
  );
  const textResolvers = useRef(new Map<string, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>());

  useEffect(() => {
    // Plain public-path string, not `new URL('./embedder.worker.ts',
    // import.meta.url)` — see scripts/build-worker.mjs for why: that
    // pattern gets pulled into Next.js's SSR compilation graph and
    // resolves transformers.js's Node build there, which fails. The
    // actual worker bundle is pre-built by esbuild into
    // public/worker/embedder.worker.js as part of `pnpm run build`.
    const worker = new Worker("/worker/embedder.worker.js", { type: "module" });
    workerRef.current = worker;

    // The Worker script itself failing to load/parse/start (404, syntax
    // error, an uncaught throw outside the message handler) never reaches
    // the postMessage protocol at all — without this, the UI would be
    // stuck in "loading" forever with no error surfaced, exactly what
    // SPEC.md §13 rules out ("never a blank frozen map, never a silent
    // retry"). Also reject any in-flight embedNote/embedTexts promises so
    // callers don't hang.
    worker.addEventListener("error", (event) => {
      const message = event.message || "The embedder Worker failed to start.";
      setState((s) => ({ ...s, status: "error", progress: null, error: message, isAllocationFailure: false }));
      for (const resolver of noteResolvers.current.values()) resolver.reject(new Error(message));
      noteResolvers.current.clear();
      for (const resolver of textResolvers.current.values()) resolver.reject(new Error(message));
      textResolvers.current.clear();
    });

    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case "loadProgress":
          setState((s) => ({ ...s, status: "loading", variant: msg.variant, progress: { loaded: msg.loaded, total: msg.total } }));
          break;
        case "loadDone":
          setState((s) => ({
            ...s,
            status: "ready",
            variant: msg.variant,
            progress: null,
            error: null,
            isAllocationFailure: false,
            modelInfo: {
              modelId: msg.modelId,
              sizeMB: msg.sizeMB,
              cacheStatus: msg.cacheStatus,
              languageCoverage: msg.languageCoverage,
            },
          }));
          break;
        case "loadError":
          setState((s) => ({
            ...s,
            status: "error",
            variant: msg.variant,
            progress: null,
            error: msg.message,
            isAllocationFailure: msg.isAllocationFailure,
          }));
          break;
        case "embedNoteDone": {
          const resolver = noteResolvers.current.get(msg.noteId);
          resolver?.resolve({ chunks: msg.chunks, centroid: msg.centroid });
          noteResolvers.current.delete(msg.noteId);
          break;
        }
        case "embedNoteError": {
          const resolver = noteResolvers.current.get(msg.noteId);
          resolver?.reject(new Error(msg.message));
          noteResolvers.current.delete(msg.noteId);
          break;
        }
        case "embedTextsDone": {
          const resolver = textResolvers.current.get(msg.requestId);
          resolver?.resolve(msg.embeddings);
          textResolvers.current.delete(msg.requestId);
          break;
        }
        case "networkCount":
          setWorkerNetworkRequests(msg.total);
          break;
      }
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((message: WorkerRequest) => {
    workerRef.current?.postMessage(message);
  }, []);

  const load = useCallback(
    (variant: ModelVariant) => {
      setState((s) => ({ ...s, status: "loading", variant, progress: { loaded: 0, total: 0 }, error: null }));
      send({ type: "load", variant });
    },
    [send]
  );

  const embedNote = useCallback(
    (noteId: string, text: string) =>
      new Promise<{ chunks: Chunk[]; centroid: Float32Array }>((resolve, reject) => {
        noteResolvers.current.set(noteId, { resolve, reject });
        send({ type: "embedNote", noteId, text });
      }),
    [send]
  );

  const embedTexts = useCallback(
    (texts: string[]) =>
      new Promise<Float32Array[]>((resolve, reject) => {
        const requestId = `req-${Math.random().toString(36).slice(2)}-${Date.now()}`;
        textResolvers.current.set(requestId, { resolve, reject });
        send({ type: "embedTexts", requestId, texts });
      }),
    [send]
  );

  return { state, load, embedNote, embedTexts, workerNetworkRequests };
}
