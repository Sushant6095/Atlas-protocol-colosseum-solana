// Atlas realtime — barrel export (Phase 20 §4).
export type { AtlasRealtimeEvent, RealtimeTopic, TopicPriority } from "./topics";
export { topicPriority } from "./topics";
export { RealtimeTransport, type TransportStatus } from "./transport";
export {
  initRealtime,
  disposeRealtime,
  getTransport,
  subscribeTopic,
  useRealtimeStore,
  __injectEventForTest,
} from "./store";
export {
  useRealtimeSnapshot,
  useRealtimeStream,
  useRealtimeStatus,
  useRealtimeLagMs,
  useRealtimeDroppedTotal,
} from "./hooks";
