"use client";

import { useEffect, useState } from "react";

/** SPEC.md §4 Decision 3: the map "Recomputed on every add/remove/edit
 * (300ms debounce)." Generic so it can debounce whatever value the PCA
 * projection is derived from. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
