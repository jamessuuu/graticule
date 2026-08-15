"use client";

import type { Toast } from "@/lib/useToasts";

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      role="status"
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 50,
        maxWidth: "min(360px, calc(100vw - 2rem))",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "0.6rem 0.9rem",
            borderRadius: 2,
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            style={{
              background: "none",
              border: "none",
              color: "var(--paper)",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              minWidth: "44px",
              minHeight: "44px",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
