/**
 * The Embedder interface. SPEC.md §12. `model` is the only package that
 * imports `@huggingface/transformers` — nothing in `core` knows a model
 * exists (SPEC.md §11).
 */
export type LanguageCoverage = "en-only" | "multilingual-tuned-50";

export interface Embedder {
  readonly modelId: string;
  readonly sizeMB: number;
  readonly languageCoverage: LanguageCoverage;
  load(onProgress: (loaded: number, total: number) => void): Promise<void>;
  embed(texts: string[]): Promise<Float32Array[]>;
  cacheStatus(): Promise<"cold" | "warm">;
  /**
   * Not in the spec's inline `Embedder` sketch (§12) — added because
   * `core`'s `chunkNote(text, { countTokens, ... })` needs "the model's own
   * tokenizer" (§3 Decision 2) from *somewhere*, and the model layer is the
   * only place allowed to hold one. `core` still never imports a
   * tokenizer directly; it's handed this function. See
   * docs/DEVIATIONS.md #6. Counts subword tokens *without* the model's
   * special tokens ([CLS]/[SEP] etc.) — those are fixed per-chunk
   * embedding overhead, not content, so they shouldn't count against a
   * chunk's content budget.
   */
  countTokens(text: string): number;
}
