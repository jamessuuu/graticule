"use client";

import { useEffect, useState } from "react";

/**
 * SPEC.md §8: "a live Network Receipt badge: a `PerformanceObserver({type:
 * 'resource'})` counts real resource-timing entries and renders the
 * running total — '0 requests since you started typing' that visibly
 * stays 0 through paste/embed/search/cluster, incrementing only during
 * the one-time model fetch."
 *
 * Two sources are combined: this hook's own observer (the main document's
 * timeline — the app's JS/CSS bundles, fonts, and the Worker *script*
 * request itself) plus `workerNetworkRequests` (the model/tokenizer/
 * runtime fetches, which only the Worker's own timeline can see — see
 * embedder.worker.ts). `sinceReady` snapshots the combined total the
 * moment the default model first becomes usable and reports the delta
 * from there — that's "since you started" in practice, since the
 * note-taking form itself stays disabled until that same moment.
 */
export function useNetworkReceipt(workerNetworkRequests: number, modelReady: boolean) {
  const [pageRequests, setPageRequests] = useState(0);

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((list) => {
      setPageRequests((count) => count + list.getEntries().length);
    });
    try {
      observer.observe({ type: "resource", buffered: true });
    } catch {
      // Old-browser fallback: no PerformanceObserver "resource" support —
      // the badge just reports 0/0 rather than throwing.
      return;
    }
    return () => observer.disconnect();
  }, []);

  const total = pageRequests + workerNetworkRequests;

  // "Adjust state during render" — react.dev's own documented pattern for
  // storing a snapshot from an earlier render (see "You Might Not Need an
  // Effect" → "storing information from previous renders") — snapshots
  // `total` the render that `modelReady` first flips true, directly in
  // the render body rather than an effect. This avoids both an
  // effect-body setState (flagged by react-hooks/set-state-in-effect) and
  // a ref read/write during render (flagged by react-hooks/refs): a plain
  // state read is exactly what render is for.
  const [prevModelReady, setPrevModelReady] = useState(modelReady);
  const [baseline, setBaseline] = useState<number | null>(null);
  if (modelReady !== prevModelReady) {
    setPrevModelReady(modelReady);
    if (modelReady && baseline === null) {
      setBaseline(total);
    }
  }

  const sinceReady = baseline === null ? 0 : Math.max(0, total - baseline);

  return { total, sinceReady };
}
