"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  // SSR/first-paint default — must match what the client renders before
  // hydration to avoid a mismatch; `false` (motion allowed) is the safe,
  // non-assuming default.
  return false;
}

/** SPEC.md §4: "prefers-reduced-motion: point transitions snap instead of
 * tweening." `useSyncExternalStore` is the React-idiomatic way to read
 * external, browser-only state consistently across SSR and the client —
 * a plain useState+useEffect polling pattern works too (and did, verified
 * live) but this is the API React 18+ actually built for this. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
