// Web Vitals reporter (Phase 20 §10).
//
// Reads LCP / INP / CLS / FCP / TTFB and ships them to Atlas's own
// telemetry beacon. Never to a third-party analytics SDK; opt-out
// respected via the `at_no_telemetry` localStorage key.

"use client";

import { perfBudget } from "../tokens";

export type RouteClass = keyof typeof perfBudget.vitals;

export interface VitalSample {
  name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
  value: number;
  /** Route class declared by the page wrapper. */
  route_class: RouteClass;
  /** `good` / `needs_improvement` / `poor` per the Vitals thresholds. */
  rating: "good" | "needs_improvement" | "poor";
  navigation_id: string;
}

const subscribers = new Set<(sample: VitalSample) => void>();

export function onVital(handler: (sample: VitalSample) => void): () => void {
  subscribers.add(handler);
  return () => { subscribers.delete(handler); };
}

function emit(sample: VitalSample): void {
  if (
    typeof window !== "undefined"
    && window.localStorage?.getItem("at_no_telemetry") === "1"
  ) return;
  for (const s of subscribers) {
    try { s(sample); } catch { /* swallow — reporter isn't a tested path */ }
  }
}

/**
 * Initialise the Vitals reporter for a given route class. Call from
 * the route's client wrapper. The peer-dep `web-vitals` is loaded
 * dynamically so SSR + non-browser tests skip cleanly.
 */
export async function initVitals(routeClass: RouteClass): Promise<void> {
  if (typeof window === "undefined") return;
  // Use dynamic import — `web-vitals` is added as an optional
  // peer-dep so tooling that doesn't need it (Storybook, tests)
  // can skip the asset.
  const mod = await safeImportWebVitals();
  if (!mod) return;
  const navigationId = mkNavId();
  const send = (name: VitalSample["name"]) =>
    (entry: { value: number; rating?: VitalSample["rating"] }) => {
      emit({
        name,
        value: entry.value,
        route_class: routeClass,
        rating: entry.rating ?? rateAgainstBudget(name, entry.value, routeClass),
        navigation_id: navigationId,
      });
    };
  mod.onLCP?.(send("LCP"));
  mod.onINP?.(send("INP"));
  mod.onCLS?.(send("CLS"));
  mod.onFCP?.(send("FCP"));
  mod.onTTFB?.(send("TTFB"));
}

function rateAgainstBudget(
  name: VitalSample["name"],
  value: number,
  route: RouteClass,
): VitalSample["rating"] {
  const b = perfBudget.vitals[route];
  if (name === "LCP") return value <= b.lcpMs ? "good" : value <= b.lcpMs * 1.5 ? "needs_improvement" : "poor";
  if (name === "INP") return value <= b.inpMs ? "good" : value <= b.inpMs * 1.5 ? "needs_improvement" : "poor";
  if (name === "CLS") return value <= b.cls ? "good" : value <= b.cls * 2 ? "needs_improvement" : "poor";
  return "good";
}

function mkNavId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type WebVitalsModule = {
  onLCP?: (cb: (m: { value: number; rating?: VitalSample["rating"] }) => void) => void;
  onINP?: (cb: (m: { value: number; rating?: VitalSample["rating"] }) => void) => void;
  onCLS?: (cb: (m: { value: number; rating?: VitalSample["rating"] }) => void) => void;
  onFCP?: (cb: (m: { value: number; rating?: VitalSample["rating"] }) => void) => void;
  onTTFB?: (cb: (m: { value: number; rating?: VitalSample["rating"] }) => void) => void;
};

async function safeImportWebVitals(): Promise<WebVitalsModule | null> {
  try {
    // The peer dep is optional; `web-vitals` is loaded only when
    // installed.
    return (await import(/* webpackIgnore: true */ "web-vitals")) as WebVitalsModule;
  } catch {
    return null;
  }
}
