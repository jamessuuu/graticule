"use client";

import type { EmbedderState, ModelVariant } from "@/lib/useEmbedderWorker";
import { MULTILINGUAL_MODEL_SIZE_MB } from "@graticule/model";

interface Props {
  embedderState: EmbedderState;
  switchModel: (variant: ModelVariant) => void;
  reembedding: boolean;
  noteCount: number;
}

/**
 * SPEC.md §9: the multilingual upgrade is "explicit opt-in, gesture-
 * gated, never auto-fetched." The button states the size before the
 * click, with a real byte-progress bar once clicked, and sets the time
 * expectation plainly. Switching re-embeds every chunk (§9) — the
 * position-is-relative disclosure is already permanent beside the map
 * (§4), so re-triggering a recompute here re-surfaces it there, not a
 * separate copy of the same sentence.
 */
export function ModelUpgrade({ embedderState, switchModel, reembedding, noteCount }: Props) {
  const isMultilingual = embedderState.variant === "multilingual";
  const isMultilingualReady = isMultilingual && embedderState.status === "ready";
  const isMultilingualLoading = isMultilingual && embedderState.status === "loading";
  const isMultilingualError = isMultilingual && embedderState.status === "error";

  if (isMultilingualReady) {
    return (
      <p className="receipt-row" role="status">
        multilingual model active ({embedderState.modelInfo?.cacheStatus}) — tuned for ~50 languages, see{" "}
        <a href="/coverage/">coverage</a>
      </p>
    );
  }

  if (isMultilingualLoading) {
    const { progress } = embedderState;
    const pct = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null;
    return (
      <p className="receipt-row" role="status" aria-live="polite">
        loading multilingual model{pct !== null ? ` — ${pct}%` : "…"}
        {progress && progress.total > 0
          ? ` (${(progress.loaded / 1_000_000).toFixed(1)}MB / ${(progress.total / 1_000_000).toFixed(1)}MB)`
          : null}
      </p>
    );
  }

  if (reembedding) {
    return (
      <p className="receipt-row" role="status">
        re-embedding {noteCount} note{noteCount === 1 ? "" : "s"} with the new model — position is relative to
        what you&apos;ve pasted and will shift, per the map&apos;s own disclosure.
      </p>
    );
  }

  return (
    <div className="callout" style={{ marginTop: "1rem" }}>
      {isMultilingualError && (
        <div role="alert">
          <p style={{ marginTop: 0 }}>
            {embedderState.isAllocationFailure
              ? "This device couldn't load the multilingual model (likely a memory limit)."
              : `The multilingual model failed to load: ${embedderState.error}`}
          </p>
          <p style={{ marginTop: 0 }}>
            <button type="button" onClick={() => switchModel("default")}>
              Continue with the smaller default model
            </button>{" "}
            — nothing you&apos;ve pasted so far was affected; it was embedded with the default model already.
          </p>
        </div>
      )}
      <p style={{ marginTop: 0 }}>
        Everything above runs on an English-tuned model. For other languages, you can load a larger multilingual
        model — entirely optional, entirely on-device.
      </p>
      <button type="button" onClick={() => switchModel("multilingual")} disabled={embedderState.status === "loading"}>
        Load multilingual model — {MULTILINGUAL_MODEL_SIZE_MB.toFixed(0)}MB, one-time download
      </button>
      <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: 0 }}>
        Can take 20-30s on a fast connection, longer on mobile. Switching re-embeds every note already pasted.
      </p>
    </div>
  );
}
