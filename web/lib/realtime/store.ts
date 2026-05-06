// Realtime Zustand store (Phase 20 §4.3, §4.4, §4.5).
//
// Components subscribe to per-topic snapshots; a separate stream API
// gives them incremental tick callbacks. Snapshots are kept on a
// requestAnimationFrame flush so a 200-tick burst on the WebSocket
// turns into one render.
//
// Backpressure: when the per-topic buffer exceeds
// `realtimeBudget.backpressureBufferMax`, the oldest non-critical
// events are dropped. Critical topics (alerts, rebalance, PER) are
// never dropped (Phase 20 §4.4).

"use client";

import { create } from "zustand";
import { realtimeBudget } from "../tokens";
import { BoundedLru } from "./lru";
import { RealtimeTransport, type TransportStatus } from "./transport";
import { topicPriority, type AtlasRealtimeEvent } from "./topics";

interface PerTopic {
  /** Last snapshot the UI has rendered. */
  snapshot: AtlasRealtimeEvent | undefined;
  /** Pending events still waiting for the next RAF flush. */
  buffer: AtlasRealtimeEvent[];
  /** Per-topic streaming subscribers. */
  streamSubs: Set<(e: AtlasRealtimeEvent) => void>;
}

interface RealtimeState {
  status: TransportStatus;
  topics: Record<string, PerTopic>;
  droppedTotal: number;
  reorderedTotal: number;
  lagSampleMs: number;
}

const initialState: RealtimeState = {
  status: "closed",
  topics: {},
  droppedTotal: 0,
  reorderedTotal: 0,
  lagSampleMs: 0,
};

export const useRealtimeStore = create<RealtimeState>(() => initialState);

// ─── Module-scoped wiring ───────────────────────────────────────────────

let transport: RealtimeTransport | null = null;
let rafQueued = false;
const dedup = new BoundedLru<string>(realtimeBudget.dedupLruEntries);

function ensureTopic(t: string): PerTopic {
  const map = useRealtimeStore.getState().topics;
  let entry = map[t];
  if (!entry) {
    entry = { snapshot: undefined, buffer: [], streamSubs: new Set() };
    useRealtimeStore.setState({ topics: { ...map, [t]: entry } });
  }
  return entry;
}

function flushBuffersOnRaf(): void {
  if (rafQueued) return;
  rafQueued = true;
  const raf =
    typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (cb: FrameRequestCallback): number => Number(setTimeout(() => cb(performance.now()), 16));
  raf(() => {
    rafQueued = false;
    const state = useRealtimeStore.getState();
    const next: Record<string, PerTopic> = { ...state.topics };
    let mutated = false;
    for (const [topic, t] of Object.entries(next)) {
      if (t.buffer.length === 0) continue;
      // Snapshot = latest by slot.
      const latest = t.buffer.reduce((acc, e) => (e.slot > acc.slot ? e : acc), t.buffer[0]);
      next[topic] = { ...t, snapshot: latest, buffer: [] };
      mutated = true;
    }
    if (mutated) useRealtimeStore.setState({ topics: next });
  });
}

function pushEvent(evt: AtlasRealtimeEvent): void {
  if (dedup.has(evt.event_id)) return;
  dedup.set(evt.event_id, true);

  const topic = ensureTopic(evt.topic);
  const lagMs = Math.max(0, Date.now() - (evt.emitted_at_ms ?? Date.now()));

  // Out-of-order check: if we already have a snapshot strictly newer
  // by more than the reorder tolerance, drop this tick.
  if (
    topic.snapshot
    && topic.snapshot.slot > evt.slot + realtimeBudget.reorderTolerance
  ) {
    useRealtimeStore.setState((s) => ({
      reorderedTotal: s.reorderedTotal + 1,
      lagSampleMs: lagMs,
    }));
    return;
  }

  topic.buffer.push(evt);

  // Backpressure: drop oldest non-critical.
  if (topic.buffer.length > realtimeBudget.backpressureBufferMax) {
    if (topicPriority(evt.topic) === "default") {
      const removed = topic.buffer.length - realtimeBudget.backpressureBufferMax;
      topic.buffer.splice(0, removed);
      useRealtimeStore.setState((s) => ({ droppedTotal: s.droppedTotal + removed }));
    }
    // Critical topics are never dropped — they would have to have a
    // genuinely broken consumer to reach this branch, and the right
    // fix is to surface a "live updates paused" pill.
  }

  // Notify streaming subscribers immediately (they own their own
  // batching if they need it).
  for (const sub of topic.streamSubs) sub(evt);

  // Update lag sample (cheap; UI reads it for the /infra panel).
  if (lagMs !== useRealtimeStore.getState().lagSampleMs) {
    useRealtimeStore.setState({ lagSampleMs: lagMs });
  }

  flushBuffersOnRaf();
}

// ─── Public API ────────────────────────────────────────────────────────

export interface InitTransportOptions {
  url: string;
  token?: string;
  socketImpl?: typeof WebSocket;
}

export function initRealtime(opts: InitTransportOptions): RealtimeTransport {
  if (transport) return transport;
  transport = new RealtimeTransport(opts);
  transport.onStatus((s) => useRealtimeStore.setState({ status: s }));
  transport.onEvent((e) => pushEvent(e));
  transport.connect();
  return transport;
}

export function getTransport(): RealtimeTransport | null {
  return transport;
}

export function disposeRealtime(): void {
  transport?.close();
  transport = null;
  useRealtimeStore.setState(initialState);
}

/**
 * Reference-counted topic subscription. Returns an unsubscribe
 * function the caller MUST invoke on unmount.
 *
 * Components typically pair this with `useRealtimeSnapshot(topic)`
 * to read the latest value. Streaming consumers (charts) pass a
 * `selector` to get every tick without rerendering the whole tree.
 */
export function subscribeTopic(
  topic: string,
  onEvent?: (e: AtlasRealtimeEvent) => void,
): () => void {
  if (!transport) {
    throw new Error("Realtime transport not initialised. Call initRealtime() first.");
  }
  const t = ensureTopic(topic);
  if (onEvent) t.streamSubs.add(onEvent);
  const unsub = transport.subscribe(topic);
  return () => {
    unsub();
    if (onEvent) t.streamSubs.delete(onEvent);
  };
}

/** Test hook — inject an event without touching the WebSocket. */
export function __injectEventForTest(e: AtlasRealtimeEvent): void {
  pushEvent(e);
}
