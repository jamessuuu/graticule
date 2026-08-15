/**
 * The transformers.js-backed Embedder. SPEC.md §9 Decision 7:
 * `device: "wasm"` always, no capability probe, no fallback ladder — WASM
 * won at every batch size measured (8.75x at batch=1, narrowing to 1.44x
 * at batch=32, never crossing over), so this project needs no GPU-absent
 * branch the way P6/P8 do.
 *
 * Version pins (SPEC.md §9 "Version pins"): `@huggingface/transformers`'s
 * own package.json pins `onnxruntime-web@1.26.0-dev.20260416-b7804b056c` as
 * a direct dependency — installing 4.2.0 brings in exactly the
 * onnxruntime-web build the spec's numbers were measured against, with no
 * separate override needed.
 */
import { AutoTokenizer, pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline, PreTrainedTokenizer } from "@huggingface/transformers";
import type { Embedder, LanguageCoverage } from "./types.js";

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

  constructor(config: TransformersEmbedderConfig) {
    this.modelId = config.modelId;
    this.sizeMB = config.sizeMB;
    this.languageCoverage = config.languageCoverage;
  }

  async load(onProgress: (loaded: number, total: number) => void): Promise<void> {
    let sawDownloadBytes = false;

    this.extractor = await pipeline("feature-extraction", this.modelId, {
      device: "wasm",
      dtype: "q8",
      progress_callback: (info) => {
        if (info.status === "progress_total") {
          if (info.loaded > 0) sawDownloadBytes = true;
          onProgress(info.loaded, info.total);
        }
      },
    });

    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
    this.lastLoadWasFromCache = !sawDownloadBytes;
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
