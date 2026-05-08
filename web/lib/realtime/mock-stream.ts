// Mock realtime stream — Wave 3.
//
// Atlas's realtime engine (Phase 20 §4) expects a single multiplexed
// WebSocket. The production transport lives in `transport.ts`. For
// the hackathon demo there's no Rust WS server yet, so this module
// provides a deterministic, seeded source that injects events into
// the same store the real transport feeds.
//
// Cadence is deliberate, not random:
//   - rebalance events: 1 per ~9s, rotating across 4 vaults
//   - infra ticks (rpc/proof/tps): 1 per ~5s
//   - alerts: 1 per ~22s, rotating severity
//
// Every event is content-addressed (event_id = blake3-equivalent),
// matches the Phase 20 §4 schema, and re-keyed if the page reloads
// so dedup works without surprising stalls.

"use client";

import { __injectEventForTest, initRealtime } from "./store";
import type { AtlasRealtimeEvent } from "./topics";

// Stub WebSocket that never connects, never errors. Lets the
// transport object exist (so subscribeTopic() succeeds) without
// pulling on a backend that doesn't exist yet.
class NoopSocket {
  static readonly OPEN = 1;
  readyState = 0;
  onopen:    null | (() => void) = null;
  onmessage: null | ((e: MessageEvent) => void) = null;
  onclose:   null | (() => void) = null;
  onerror:   null | (() => void) = null;
  constructor(_url: string) { /* never opens */ }
  send(_d: unknown): void { /* swallow */ }
  close(): void { /* noop */ }
}

const VAULTS = [
  "ab12cdef" + "0".repeat(56),
  "01a02b03" + "0".repeat(56),
  "ff10ee20" + "0".repeat(56),
  "deadbeef" + "0".repeat(56),
];

const PROTOCOLS = ["kamino", "drift", "marginfi", "jupiter"] as const;
const RPC_SOURCES = ["helius-mainnet", "triton-1", "rpc-pool", "quicknode"];

interface RebalancePayload {
  vault_id: string;
  public_input_hash: string;
  slot: number;
  shifts: { protocol: string; bps_delta: number }[];
  proof_status: "verified" | "pending" | "rejected";
}

interface RpcLatencyTick {
  rpc_latency: { source: string; role: string; region: string; p50_ms: number; p99_ms: number }[];
  bundles_landed_5m: number;
  bundles_attempted_5m: number;
  proof_gen_p50_ms: number;
  proof_gen_p99_ms: number;
  tps: { true_tps: number; vote_removed_tps: number; sample_age_ms: number };
}

let started = false;
let timers: ReturnType<typeof setInterval>[] = [];
let baseSlot = 246_500_000;
let tickN = 0;

/**
 * Begin emitting deterministic events into the realtime store.
 * Idempotent — calling twice is a no-op. Returns a teardown function.
 */
export function startMockStream(): () => void {
  if (started || typeof window === "undefined") return () => undefined;
  started = true;

  // Init the transport with a stub WebSocket so consumers can call
  // subscribeTopic / useRealtimeSnapshot without a real backend.
  initRealtime({
    url: "wss://mock.atlas.local/api/v1/stream",
    socketImpl: NoopSocket as unknown as typeof WebSocket,
  });

  // Rebalances — every 9s, one vault.
  timers.push(setInterval(() => {
    const i = tickN++;
    const vault = VAULTS[i % VAULTS.length];
    const slot = baseSlot + i * 64;
    const a = PROTOCOLS[i % PROTOCOLS.length];
    const b = PROTOCOLS[(i + 2) % PROTOCOLS.length];
    const shift = 60 + (i % 5) * 40; // 60..220 bps
    const payload: RebalancePayload = {
      vault_id: vault,
      public_input_hash: hexHash(`rebalance:${vault}:${slot}`),
      slot,
      shifts: [
        { protocol: a, bps_delta:  shift },
        { protocol: b, bps_delta: -shift },
      ],
      proof_status: "verified",
    };
    inject(`stream.vault.${vault}.rebalance`, slot, payload);
  }, 9_000));

  // Infra snapshot — every 5s.
  timers.push(setInterval(() => {
    const slot = ++baseSlot;
    inject<RpcLatencyTick>("stream.network", slot, synthInfra(slot));
  }, 5_000));

  // Alerts — every 22s, rotating.
  const SEVERITIES = ["info", "warning", "critical"] as const;
  timers.push(setInterval(() => {
    const i = tickN;
    const slot = baseSlot;
    const severity = SEVERITIES[i % 3];
    inject(`stream.vault.${VAULTS[i % 4]}.alert`, slot, {
      severity,
      title: severity === "critical" ? "Oracle deviation" : severity === "warning" ? "Drift APY decay" : "Quorum recovered",
      detail: severity === "critical"
        ? "Pyth pull on USDC/SOL exceeded 80 bps deviation. Defensive mode held."
        : severity === "warning"
        ? "Drift kSOL APY decayed 220 bps over 14d window — agent yield voted soft veto."
        : "RPC tier-A quorum recovered after 14s degradation.",
      emitted_at_ms: Date.now(),
    });
  }, 22_000));

  // Emit one of each immediately so the UI isn't empty on mount.
  setTimeout(() => {
    inject(`stream.vault.${VAULTS[0]}.rebalance`, baseSlot, {
      vault_id: VAULTS[0],
      public_input_hash: hexHash("seed-0"),
      slot: baseSlot,
      shifts: [
        { protocol: "kamino",  bps_delta:  120 },
        { protocol: "drift",   bps_delta: -120 },
      ],
      proof_status: "verified",
    });
    inject<RpcLatencyTick>("stream.network", baseSlot, synthInfra(baseSlot));
  }, 200);

  return stopMockStream;
}

export function stopMockStream(): void {
  for (const t of timers) clearInterval(t);
  timers = [];
  started = false;
}

function inject<T>(topic: string, slot: number, payload: T): void {
  const event: AtlasRealtimeEvent<T> = {
    event_id: hexHash(`${topic}:${slot}`),
    topic,
    slot,
    emitted_at_ms: Date.now(),
    payload,
  };
  __injectEventForTest(event);
}

function synthInfra(slot: number): RpcLatencyTick {
  // Drift the values around their healthy band so the operator sees
  // life without the page jumping. Deterministic per slot.
  const phase = (slot / 7) % 1;
  return {
    rpc_latency: RPC_SOURCES.flatMap((src) => [
      { source: src, role: "tier_a_latency", region: "eu",
        p50_ms: 60  + Math.round(20 * Math.sin(phase * Math.PI * 2)),
        p99_ms: 180 + Math.round(40 * Math.sin(phase * Math.PI * 2 + 1)) },
      { source: src, role: "tier_b_quorum", region: "us",
        p50_ms: 220 + Math.round(60 * Math.cos(phase * Math.PI * 2)),
        p99_ms: 540 + Math.round(110 * Math.cos(phase * Math.PI * 2 + 1)) },
    ]),
    bundles_landed_5m: 540 + Math.round(40 * Math.sin(phase * Math.PI * 2)),
    bundles_attempted_5m: 720 + Math.round(30 * Math.cos(phase * Math.PI * 2)),
    proof_gen_p50_ms: 18_000 + Math.round(2_500 * Math.sin(phase * Math.PI * 2)),
    proof_gen_p99_ms: 52_000 + Math.round(8_000 * Math.cos(phase * Math.PI * 2)),
    tps: {
      true_tps: 3_400 + Math.round(450 * Math.sin(phase * Math.PI * 2)),
      vote_removed_tps: 2_100 + Math.round(220 * Math.cos(phase * Math.PI * 2)),
      sample_age_ms: 800,
    },
  };
}

// FNV-1a hex hash — deterministic, fast, no crypto. Same intent as
// the Rust crate's blake3 keys — exact bytes don't matter, but
// stable cardinality does.
function hexHash(s: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const ch of s) {
    h ^= BigInt(ch.charCodeAt(0));
    h = (h * prime) & mask;
  }
  let hex = h.toString(16).padStart(16, "0");
  while (hex.length < 64) hex = "00" + hex;
  return hex;
}
