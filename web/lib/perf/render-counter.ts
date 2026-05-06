// Render-counter dev hook (Phase 20 §10).
//
// In dev, components register their identity and we count render
// invocations. Sampled, dev-only — never ships to production.
// Useful for catching state-subscription bugs (one row mutating
// triggers a tree-wide rerender).

"use client";

import { useEffect, useRef } from "react";

const counts = new Map<string, number>();

export function useRenderCounter(label: string): void {
  if (process.env.NODE_ENV === "production") return;
  const ref = useRef(0);
  ref.current += 1;
  counts.set(label, (counts.get(label) ?? 0) + 1);
  useEffect(() => {
    if (ref.current % 100 === 0 && typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(`[atlas/perf] ${label} has rendered ${ref.current} times`);
    }
  });
}

export function snapshotRenderCounts(): Record<string, number> {
  return Object.fromEntries(counts.entries());
}

export function resetRenderCounts(): void {
  counts.clear();
}
