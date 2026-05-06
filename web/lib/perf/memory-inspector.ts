// Dev-only memory inspector (Phase 20 §8 + §9.3).
//
// Polls `performance.memory.usedJSHeapSize` once per minute and
// warns on monotonic growth across navigation. The Chrome-only
// API is gated behind a typeof check so the hook is a no-op in
// other browsers / SSR.

"use client";

import { useEffect } from "react";
import { perfBudget } from "../tokens";

interface ChromeMemory { usedJSHeapSize: number }
type ChromePerf = Performance & { memory?: ChromeMemory };

export interface MemorySample {
  observed_at_ms: number;
  used_mb: number;
  /** Route the user was on when the sample was taken. */
  route_label: string;
}

const samples: MemorySample[] = [];
const MAX_SAMPLES = 60; // 1 hour at 1/minute
const POLL_MS = 60_000;
const MONOTONIC_GROWTH_WARN_MB = 80;

export function useMemoryInspector(routeLabel: string): void {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    const perf = window.performance as ChromePerf;
    if (!perf?.memory) return;
    const tick = () => {
      const used_mb = perf.memory!.usedJSHeapSize / (1024 * 1024);
      const observed_at_ms = Date.now();
      samples.push({ observed_at_ms, used_mb, route_label: routeLabel });
      if (samples.length > MAX_SAMPLES) samples.shift();
      const first = samples[0];
      if (
        first
        && samples.length >= 5
        && samples.every((s, i) => i === 0 || s.used_mb >= samples[i - 1].used_mb - 1)
        && used_mb - first.used_mb > MONOTONIC_GROWTH_WARN_MB
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          `[atlas/perf] heap growing monotonically: ${first.used_mb.toFixed(1)} → ${used_mb.toFixed(1)} MB over ${samples.length} samples`,
        );
      }
      if (used_mb > perfBudget.runtime.memoryMbAfterTenMin) {
        // eslint-disable-next-line no-console
        console.warn(
          `[atlas/perf] heap ${used_mb.toFixed(1)} MB exceeds 10-minute budget ${perfBudget.runtime.memoryMbAfterTenMin} MB`,
        );
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [routeLabel]);
}

export function memorySnapshots(): MemorySample[] {
  return [...samples];
}
