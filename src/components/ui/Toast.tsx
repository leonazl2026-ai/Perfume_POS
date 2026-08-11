"use client";

import { useEffect } from "react";

export interface ToastMessage {
  /** Bumped on every notification so repeat messages re-trigger the timer. */
  id: number;
  kind: "success" | "error";
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ toast, onDismiss, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  const isError = toast.kind === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
        {isError ? "⚠" : "✓"}
      </span>
      <p className="flex-1 text-sm font-medium">{toast.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-lg leading-none opacity-60 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
