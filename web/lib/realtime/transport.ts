// Single multiplexed WebSocket transport (Phase 20 §4.1, §4.6).
//
// One connection per session, namespaced by topic strings. Topic
// subscribe / unsubscribe is reference-counted so a panel scrolling
// in/out of the viewport doesn't double-bill the connection.
//
// Reconnection: exponential backoff with jitter; after
// `realtimeBudget.reconnectAttemptsBeforePill` failures, the
// connection status flips to `degraded` and the UI surfaces a
// non-blocking pill in the corner.

import { realtimeBudget } from "../tokens";
import type { AtlasRealtimeEvent } from "./topics";

export type TransportStatus = "connecting" | "open" | "degraded" | "closed";

export type StatusListener = (s: TransportStatus) => void;
export type EventListener = (e: AtlasRealtimeEvent) => void;

interface PendingSub {
  topic: string;
  refCount: number;
  /** True iff the server has acknowledged the subscribe message. */
  acked: boolean;
}

const RECONNECT_BASE_MS = 250;
const RECONNECT_MAX_MS  = 16_000;

export interface TransportConfig {
  /** WebSocket URL — typically `wss://atlas.example/api/v1/stream`. */
  url: string;
  /** Optional auth bearer token. Sent in the connect handshake. */
  token?: string;
  /** Test hook for non-DOM environments. */
  socketImpl?: typeof WebSocket;
}

export class RealtimeTransport {
  private readonly url: string;
  private readonly token: string | undefined;
  private readonly Socket: typeof WebSocket;
  private socket: WebSocket | null = null;
  private status: TransportStatus = "closed";

  private readonly subs = new Map<string, PendingSub>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly eventListeners = new Set<EventListener>();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;

  constructor(cfg: TransportConfig) {
    this.url = cfg.url;
    this.token = cfg.token;
    this.Socket = cfg.socketImpl ?? (typeof WebSocket !== "undefined" ? WebSocket : (undefined as unknown as typeof WebSocket));
  }

  // ─── Public surface ────────────────────────────────────────────────

  connect(): void {
    if (this.socket || !this.Socket) return;
    this.explicitlyClosed = false;
    this.transition("connecting");
    const url = this.token ? `${this.url}?token=${encodeURIComponent(this.token)}` : this.url;
    const sock = new this.Socket(url);
    this.socket = sock;
    sock.onopen = () => this.handleOpen();
    sock.onmessage = (m) => this.handleMessage(m);
    sock.onclose = () => this.handleClose();
    sock.onerror = () => { /* close handler runs on error too */ };
  }

  close(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.transition("closed");
  }

  /**
   * Reference-counted subscribe. Returns an unsubscribe function the
   * caller MUST invoke on unmount (Phase 20 §8 lifecycle hygiene).
   */
  subscribe(topic: string): () => void {
    const sub = this.subs.get(topic);
    if (sub) {
      sub.refCount += 1;
    } else {
      this.subs.set(topic, { topic, refCount: 1, acked: false });
      this.send({ kind: "subscribe", topic });
    }
    return () => this.unsubscribe(topic);
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => { this.statusListeners.delete(listener); };
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private unsubscribe(topic: string): void {
    const sub = this.subs.get(topic);
    if (!sub) return;
    sub.refCount -= 1;
    if (sub.refCount <= 0) {
      this.subs.delete(topic);
      this.send({ kind: "unsubscribe", topic });
    }
  }

  private send(payload: unknown): void {
    const sock = this.socket;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    try {
      sock.send(JSON.stringify(payload));
    } catch {
      // The close handler will fire and trigger reconnect.
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.transition("open");
    // Re-subscribe everything.
    for (const sub of this.subs.values()) {
      sub.acked = false;
      this.send({ kind: "subscribe", topic: sub.topic });
    }
  }

  private handleMessage(m: MessageEvent): void {
    let parsed: AtlasRealtimeEvent | null = null;
    try {
      parsed = JSON.parse(typeof m.data === "string" ? m.data : "") as AtlasRealtimeEvent;
    } catch {
      return;
    }
    if (!parsed || !parsed.topic) return;
    for (const l of this.eventListeners) l(parsed);
  }

  private handleClose(): void {
    this.socket = null;
    if (this.explicitlyClosed) {
      this.transition("closed");
      return;
    }
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts >= realtimeBudget.reconnectAttemptsBeforePill) {
      this.transition("degraded");
    } else {
      this.transition("connecting");
    }
    const delay = backoff(this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private transition(next: TransportStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }
}

function backoff(attempt: number): number {
  const exp = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  // ±25% jitter, deterministic-ish via Math.random — pure UI gating, not a security path.
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.max(RECONNECT_BASE_MS, Math.round(exp + jitter));
}
