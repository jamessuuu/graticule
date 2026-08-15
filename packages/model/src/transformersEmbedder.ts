/**
 * The transformers.js-backed Embedder. SPEC.md §9 Decision 7:
 * `device: "wasm"` always, no capability probe, no fallback ladder — WASM
 * won at every batch size measured (8.75x at batch=1, narrowing to 1.44x
 * at batch=32, never crossing over), so this project needs no GPU-absent
 * branch the way P6/P8 do. That decision is scoped to the *shipped
 * product*, which only ever runs in the browser Worker.
 *
 * `onnxruntime-web`'s "wasm" execution provider does not exist in
 * `onnxruntime-node` (Node's build of transformers.js only offers
 * cpu/webgpu/dml) — so this class picks its device from the real runtime
 * environment: "wasm" in the browser/Worker (Decision 7), "cpu" under
 * Node. This is not a fallback ladder or a capability probe (both
 * explicitly rejected by Decision 7); it's the same class correctly
 * targeting two different *callers* — the shipped Worker, and
 * `scripts/verify-fixtures.mjs` running "the actual model in Node
 * (onnxruntime-node)" per §14 Decision 8. §14 names the consequence
 * directly: Node's execution provider can differ marginally from the
 * browser's WASM path, which is exactly why the isomorphism epsilon check
 * (±0.01 cosine, Node vs. the deployed site) exists.
 *
 * (transformers.js does track this itself as an internal `apis.IS_NODE_ENV`
 * flag, but `apis` isn't part of the package's public `exports` map —
 * importing it needs a deep, unsupported subpath. Detecting Node the
 * standard way via `process.versions.node` avoids depending on library
 * internals.)
 *
 * Version pins (SPEC.md §9 "Version pins"): `@huggingface/transformers`'s
 * own package.json pins `onnxruntime-web@1.26.0-dev.20260416-b7804b056c` as
 * a direct dependency — installing 4.2.0 brings in exactly the
 * onnxruntime-web build the spec's numbers were measured against, with no
 * separate override needed.
 */
import { AutoTokenizer, pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline, PreTrainedTokenizer } from "@huggingface/transformers";
import type { Embedder, LanguageCoverage } from "./types";

function isNodeRuntime(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return Boolean(proc?.versions?.node);
}

function pipelineDevice(): "wasm" | "cpu" {
  return isNodeRuntime() ? "cpu" : "wasm";
}

export interface TransformersEmbedderConfig {
  modelId: string;
  sizeMB: number;
  languageCoverage: LanguageCoverage;
}

export class TransformersEmbedder implements Embedder {
  readonly modelId: string;
  readonly sizeMB: number;
  readonly languageCoverage: LanguageCoverage;

  private extractor: FeatureExtractionPipeline | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private lastLoadWasFromCache: boolean | null = null;

  /** Above real warm-load timings and below real cold-load timings in
   * both environments this was measured in: Node cache-hit ~125ms vs.
   * cold ~4.7s; this desktop's browser warm ~300ms vs. cold ~5.0-5.4s
   * (SPEC.md's facts line). transformers.js's own progress callback fires
   * `progress_total` events with real byte counts on a filesystem/Cache
   * Storage hit too (verified empirically — it is not a network-only
   * signal), so elapsed wall-clock time is the more honest classifier
   * here, not "did any progress event report loaded>0". */
  private static readonly WARM_LOAD_THRESHOLD_MS = 1500;

  constructor(config: TransformersEmbedderConfig) {
    this.modelId = config.modelId;
    this.sizeMB = config.sizeMB;
    this.languageCoverage = config.languageCoverage;
  }

  async load(onProgress: (loaded: number, total: number) => void): Promise<void> {
    const start = Date.now();

    this.extractor = await pipeline("feature-extraction", this.modelId, {
      device: pipelineDevice(),
      dtype: "q8",
      progress_callback: (info) => {
        if (info.status === "progress_total") {
          onProgress(info.loaded, info.total);
        }
      },
    });

    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
    this.lastLoadWasFromCache = Date.now() - start < TransformersEmbedder.WARM_LOAD_THRESHOLD_MS;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.extractor) {
      throw new Error(`${this.modelId}: load() must resolve before embed()`);
    }
    if (texts.length === 0) return [];

    const output = await this.extractor(texts, { pooling: "mean", normalize: true });
    const dims = output.dims;
    const n = dims[0] ?? texts.length;
    const dim = dims[1] ?? 0;
    const flat = output.data;

    const result: Float32Array[] = [];
    for (let i = 0; i < n; i++) {
      const row = flat.slice(i * dim, (i + 1) * dim);
      result.push(new Float32Array(row as ArrayLike<number>));
    }
    return result;
  }

  countTokens(text: string): number {
    if (!this.tokenizer) {
      throw new Error(`${this.modelId}: load() must resolve before countTokens()`);
    }
    return this.tokenizer.encode(text, { add_special_tokens: false }).length;
  }

  async cacheStatus(): Promise<"cold" | "warm"> {
    if (this.lastLoadWasFromCache !== null) {
      return this.lastLoadWasFromCache ? "warm" : "cold";
    }
    // Not loaded yet this session — best-effort check of the Cache
    // Storage entries transformers.js itself writes to (env.cacheKey
    // defaults to "transformers-cache"), so the ModelLifecycle UI can
    // show an accurate cold/warm expectation *before* the visitor clicks
    // load. This is a convenience label only — the authoritative,
    // falsifiable proof of network activity is the Network Receipt's
    // PerformanceObserver (SPEC.md §8), not this heuristic.
    if (typeof caches === "undefined") return "cold";
    try {
      const cache = await caches.open("transformers-cache");
      const keys = await cache.keys();
      const hasModel = keys.some((req) => req.url.includes(this.modelId));
      return hasModel ? "warm" : "cold";
    } catch {
      return "cold";
    }
  }
}
