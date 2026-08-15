/**
 * The two shipped embedders. SPEC.md §9.
 *
 * Default (Tier 1, 5-50MB band): Xenova/all-MiniLM-L6-v2 q8, WASM.
 * Cold ~5.0-5.4s / warm ~300ms, 0 bytes (this desktop; Tier A/B
 * unverified — see SPEC.md's facts line).
 *
 * Multilingual upgrade (Tier 2, explicit opt-in only — never auto-fetched,
 * SPEC.md §9): Xenova/paraphrase-multilingual-MiniLM-L12-v2 q8. Warm
 * 763ms, 0 bytes.
 */
import { TransformersEmbedder } from "./transformersEmbedder";
import type { Embedder } from "./types";

export const DEFAULT_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const DEFAULT_MODEL_SIZE_MB = 26.8;

export const MULTILINGUAL_MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const MULTILINGUAL_MODEL_SIZE_MB = 140.38;

export function createDefaultEmbedder(): Embedder {
  return new TransformersEmbedder({
    modelId: DEFAULT_MODEL_ID,
    sizeMB: DEFAULT_MODEL_SIZE_MB,
    languageCoverage: "en-only",
  });
}

export function createMultilingualEmbedder(): Embedder {
  return new TransformersEmbedder({
    modelId: MULTILINGUAL_MODEL_ID,
    sizeMB: MULTILINGUAL_MODEL_SIZE_MB,
    languageCoverage: "multilingual-tuned-50",
  });
}
