// Background-tab discipline (Phase 24 §2.4).
//
// Tabs in the background still receive WebSocket frames, but the
// browser throttles RAF to ~1 Hz. Without intervention, a 200-tick
// burst that arrives while hidden would land all at once on
// visibilitychange and stutter the first foreground frame.
//
// Strategy:
//   • While `document.visibilityState === "hidden"`, drop default-
//     priority events and keep only critical (alerts, rebalance,
//     PER) on a bounded ring. The dedup LRU still catches dups.
//   • On return to "visible", resume normal flow and emit a single
//     synthetic snapshot per topic from the most recent buffered
//     event so the UI re-syncs in one render.
//   • A heartbeat counter tracks how many ticks were skipped while
//     hidden; surfaced to /infra for the "live updates paused" pill.
//
// This module is wired by `store.ts` via `installBackgroundTabGate()`
// and is a no-op outside the browser.

"use client";

import { topicPriority, type AtlasRealtimeEvent } from "./topics";

interface GateState {
  hidden: boolean;
  /** Per-topic latest event captured while hidden. */
  parked: Map<string, AtlasRealtimeEvent>;
  /** Count of default-priority events skipped while hidden. */
  skippedTotal: number;
}

const state: GateState = {
  hidden: false,
  parked: new Map(),
  skippedTotal: 0,
};

let installed = false;
let onResume: ((events: AtlasRealtimeEvent[]) => void) | null = null;

/**
 * Install the visibility gate. The store passes `replay` which is
 * called with the parked events when the tab returns to foreground.
 * Returns a teardown function.
 */
export function installBackgroundTabGate(
  replay: (events: AtlasRealtimeEvent[]) => void,
): () => void {
  if (installed || typeof document === "undefined") return () => undefined;
  installed = true;
  onResume = replay;

  const handler = (): void => {
    const hidden = document.visibilityState === "hidden";
    if (state.hidden && !hidden) {
      // Resume — flush parked events in slot order.
      const events = Array.from(state.parked.values()).sort((a, b) => a.slot - b.slot);
      state.parked.clear();
      state.hidden = false;
      onResume?.(events);
    } else {
      state.hidden = hidden;
    }
  };

  document.addEventListener("visibilitychange", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    installed = false;
    onResume = null;
    state.hidden = false;
    state.parked.clear();
  };
}

/**
 * Returns true iff the caller should bypass the normal push path
 * because the tab is hidden. Critical events still flow through
 * (return false) so alerts surface on resume via OS notifications
 * or the system pill.
 */
export function shouldParkWhileHidden(evt: AtlasRealtimeEvent): boolean {
  if (!state.hidden) return false;
  if (topicPriority(evt.topic) === "critical") return false;

  const existing = state.parked.get(evt.topic);
  if (!existing || evt.slot > existing.slot) {
    state.parked.set(evt.topic, evt);
  }
  state.skippedTotal += 1;
  return true;
}

export function getSkippedWhileHiddenTotal(): number {
  return state.skippedTotal;
}

export function isHidden(): boolean {
  return state.hidden;
}

/** Test hook — force the gate state without DOM. */
export function __setHiddenForTest(hidden: boolean): void {
  state.hidden = hidden;
  if (!hidden) state.parked.clear();
}
