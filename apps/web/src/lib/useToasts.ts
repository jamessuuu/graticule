"use client";

import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: string;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

/** SPEC.md §7: duplicates and session-cap refusals "surface a toast
 * rather than a silent duplicate point" / "a clear refusal." */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const pushToast = useCallback((message: string) => {
    const id = `toast-${counter.current++}`;
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
