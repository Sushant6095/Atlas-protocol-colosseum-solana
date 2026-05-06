// Realtime React hooks (Phase 20 §4.5).
//
// `useRealtimeSnapshot` — read the most recent value for a topic.
// Component re-renders only when the snapshot changes (RAF-flushed
// in the store, so a 200-tick burst is one render).
//
// `useRealtimeStream` — receive every tick via a callback ref.
// Useful for charts and force-directed graphs that own their own
// frame loop.
//
// `useRealtimeStatus` — connection status pill driver.

"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { AtlasRealtimeEvent } from "./topics";
import {
  subscribeTopic,
  useRealtimeStore,
} from "./store";

export function useRealtimeStatus() {
  return useRealtimeStore((s) => s.status);
}

export function useRealtimeLagMs(): number {
  return useRealtimeStore((s) => s.lagSampleMs);
}

export function useRealtimeDroppedTotal(): number {
  return useRealtimeStore((s) => s.droppedTotal);
}

/**
 * Read the latest snapshot for a topic. Subscribes on mount,
 * unsubscribes on unmount. Returns `undefined` until the first
 * tick lands.
 */
export function useRealtimeSnapshot<T = unknown>(
  topic: string,
): AtlasRealtimeEvent<T> | undefined {
  useEffect(() => subscribeTopic(topic), [topic]);
  return useRealtimeStore(
    useShallow((s) => s.topics[topic]?.snapshot as AtlasRealtimeEvent<T> | undefined),
  );
}

/**
 * Stream every tick for a topic into a stable callback. Caller's
 * handler does NOT cause a rerender of the calling component — it
 * gets called with each event as it arrives. Use this from chart /
 * canvas / r3f code where the consumer owns its own frame loop.
 */
export function useRealtimeStream<T = unknown>(
  topic: string,
  onEvent: (e: AtlasRealtimeEvent<T>) => void,
): void {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  useEffect(
    () =>
      subscribeTopic(topic, (e) => {
        ref.current(e as AtlasRealtimeEvent<T>);
      }),
    [topic],
  );
}
