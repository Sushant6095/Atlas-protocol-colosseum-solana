// Long-task watcher (Phase 20 §9.3).
//
// Listens to PerformanceObserver entries of type 'longtask' and
// reports any that exceed `perfBudget.runtime.longTaskThresholdMs`.
// Warning-only in dev; production routes wire this into the
// Vitals reporter so the budget breach lands in telemetry.

"use client";

import { useEffect } from "react";
import { perfBudget } from "../tokens";

export interface LongTaskSample {
  duration_ms: number;
  start_time_ms: number;
  attribution: string;
  route_label: string;
}

type Handler = (s: LongTaskSample) => void;

export function useLongTaskWatcher(routeLabel: string, onTask?: Handler): void {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const supportedTypes =
      (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes ?? [];
    if (!supportedTypes.includes("longtask")) return;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration <= perfBudget.runtime.longTaskThresholdMs) continue;
        const sample: LongTaskSample = {
          duration_ms: Math.round(entry.duration),
          start_time_ms: Math.round(entry.startTime),
          attribution: (entry as unknown as { attribution?: { name?: string }[] }).attribution?.[0]?.name ?? "unknown",
          route_label: routeLabel,
        };
        onTask?.(sample);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn(`[atlas/perf] long task ${sample.duration_ms}ms on ${routeLabel} (${sample.attribution})`);
        }
      }
    });
    try {
      obs.observe({ type: "longtask", buffered: true });
    } catch {
      return;
    }
    return () => obs.disconnect();
  }, [routeLabel, onTask]);
}
