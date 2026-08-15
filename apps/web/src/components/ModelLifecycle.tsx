"use client";

import { useEffect, useRef } from "react";
import type { EmbedderState, ModelVariant } from "@/lib/useEmbedderWorker";

interface Props {
  embedderState: EmbedderState;
  load: (variant: ModelVariant) => void;
}

/**
 * SPEC.md §9: "Lazy-loaded via requestIdleCallback after first paint —
 * never blocks the hero." Auto-loads the default model once, idly; shows
 * determinate progress from the real fetch; and the failure-contract
 * states from §13 (never a blank frozen map, never a silent retry).
 */
export function ModelLifecycle({ embedderState, load }: Props) {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (embedderState.status !== "idle") return;
    triggered.current = true;

    const trigger = () => load("default");
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (typeof ric === "function") {
      ric(trigger);
    } else {
      // Safari-era fallback: a short timeout still keeps this off the
      // critical first-paint path.
      window.setTimeout(trigger, 200);
    }
  }, [embedderState.status, load]);

  // Once a multilingual switch is in play (loading/ready/error for that
  // variant), ModelUpgrade fully owns that messaging — showing this
  // component's generic line too would double up two "loading — X%"
  // lines, or a bare "Try again" alongside ModelUpgrade's more correct
  // "Continue with the smaller default model" recovery action.
  if (embedderState.variant === "multilingual") {
    return null;
  }

  if (embedderState.status === "idle") {
    return (
      <p className="receipt-row" role="status">
        model: queued to load once the page is idle
      </p>
    );
  }

  if (embedderState.status === "loading") {
    const { progress } = embedderState;
    const pct = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null;
    return (
      <p className="receipt-row" role="status" aria-live="polite">
        model: loading{pct !== null ? ` — ${pct}%` : "…"}
        {progress && progress.total > 0
          ? ` (${(progress.loaded / 1_000_000).toFixed(1)}MB / ${(progress.total / 1_000_000).toFixed(1)}MB)`
          : null}
      </p>
    );
  }

  if (embedderState.status === "error") {
    return (
      <div className="callout" role="alert">
        <p>
          {embedderState.isAllocationFailure
            ? "This device couldn't load the model (likely a memory limit)."
            : "The model failed to load."}
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{embedderState.error}</p>
        <button type="button" onClick={() => load(embedderState.variant ?? "default")}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <p className="receipt-row" role="status">
      model: {embedderState.modelInfo?.modelId} ready ({embedderState.modelInfo?.cacheStatus})
    </p>
  );
}
