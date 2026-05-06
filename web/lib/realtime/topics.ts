// Atlas realtime topics (Phase 20 §4.1).
//
// Topic strings are the single namespace used by the multiplexed
// WebSocket. Adding a topic is a deliberate decision — keep this
// list in sync with the backend `WsEndpoint` catalog
// (atlas-public-api/src/endpoints.rs §websocket_endpoints + the
// Phase 09 §2.3 stream contract).

export type RealtimeTopic =
  /* Public network intelligence stream (Phase 09 §2.3). */
  | "stream.network"
  /* Per-vault rebalance events. {id} = vault hex32. */
  | `stream.vault.${string}.rebalance`
  /* Per-vault alert stream. */
  | `stream.vault.${string}.alert`
  /* Phase 11 capital-flow heatmap diffs. */
  | "stream.intel.heatmap"
  /* Phase 17 /infra TPS ticks. */
  | "stream.infra.tps"
  /* Phase 17 RPC latency per source. */
  | "stream.infra.rpc-latency"
  /* Phase 18 PER session lifecycle. */
  | "stream.per.events";

/** Topic priorities — alerts and rebalance events are never dropped
 *  under backpressure (Phase 20 §4.4). */
export type TopicPriority = "critical" | "default";

export function topicPriority(topic: string): TopicPriority {
  if (topic.endsWith(".alert")) return "critical";
  if (topic.endsWith(".rebalance")) return "critical";
  if (topic === "stream.per.events") return "critical";
  return "default";
}

export interface AtlasRealtimeEvent<T = unknown> {
  /** blake3 over the canonical bytes of `(topic, slot, payload)`. */
  event_id: string;
  topic: string;
  slot: number;
  /** Server emit timestamp (ms). Used for stream-lag telemetry. */
  emitted_at_ms: number;
  payload: T;
}
