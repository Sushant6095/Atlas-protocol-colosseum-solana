// Deterministic fixture generators — Wave 3.
//
// Until the Rust API binary is wired, the Next.js /api/v1/* routes
// here render JSON shaped exactly like the production endpoints from
// these helpers. Same data hangs off the realtime store via the
// mock-stream — so the page is alive both at page-load (HTTP) and
// on-tick (WS-equivalent).
//
// All values are clock-anchored, not random, so reload doesn't
// produce wildly different snapshots.

const RPC_SOURCES = [
  { source: "helius-mainnet", region: "eu", role: "tier_a_latency" },
  { source: "triton-1",       region: "us", role: "tier_a_latency" },
  { source: "rpc-pool",       region: "eu", role: "tier_a_latency" },
  { source: "quicknode",      region: "us", role: "tier_b_quorum"  },
  { source: "shyft",          region: "ap", role: "tier_b_quorum"  },
  { source: "alchemy",        region: "eu", role: "tier_b_quorum"  },
];

const VALIDATOR_REGIONS = ["us-east", "us-west", "eu-west", "eu-central", "ap-tokyo", "ap-singapore"];

function clockPhase(): number {
  // 0..1 over a 60s wall-clock cycle. Drives the demo's "live look".
  return ((Date.now() / 1000) % 60) / 60;
}
function s(phase: number, freq = 1): number {
  return Math.sin(phase * Math.PI * 2 * freq);
}
function c(phase: number, freq = 1): number {
  return Math.cos(phase * Math.PI * 2 * freq);
}

export interface InfraFixture {
  generated_at_slot: number;
  rpc_latency: { source: string; role: string; region: string; p50_ms: number; p99_ms: number }[];
  quorum_match_rate_bps_1h: number;
  slot_lag_per_source: { source: string; lag_slots: number }[];
  attribution_heatmap: {
    source: string; consistent: number; slot_skew: number;
    content_divergence: number; outlier_share_bps: number;
  }[];
  network_tps_p50: number;
  network_tps_p99: number;
  jito_landed_rate_bps_1m: number;
  validator_latency_by_region: { region: string; p99_ms: number }[];
  cu_p50_per_rebalance: number;
  cu_p99_per_rebalance: number;
  proof_gen_p50_ms: number;
  proof_gen_p99_ms: number;
  rebalance_e2e_p50_ms: number;
  rebalance_e2e_p99_ms: number;
  pyth_post_latency_p99_ms: number;
  bundles_landed_5m: number;
  bundles_attempted_5m: number;
  tps: { true_tps: number; vote_removed_tps: number; sample_age_ms: number };
  freshness_budgets: {
    vault_id: string; slot_drift: number;
    freshness_remaining_slots: number; band: "green" | "amber" | "red";
  }[];
}

export function buildInfraFixture(): InfraFixture {
  const phase = clockPhase();
  const slot = Math.floor(246_500_000 + Date.now() / 400);

  return {
    generated_at_slot: slot,

    rpc_latency: RPC_SOURCES.map((r, i) => {
      const isA = r.role === "tier_a_latency";
      const baseP50 = isA ? 70  : 240;
      const baseP99 = isA ? 180 : 520;
      const drift = (i + 1) * 8;
      return {
        source: r.source, role: r.role, region: r.region,
        p50_ms: Math.round(baseP50 + drift + 18 * s(phase, 1 + i * 0.2)),
        p99_ms: Math.round(baseP99 + drift + 50 * c(phase, 1 + i * 0.15)),
      };
    }),

    quorum_match_rate_bps_1h: 9_900 + Math.round(60 * s(phase)),

    slot_lag_per_source: RPC_SOURCES.map((r, i) => ({
      source: r.source,
      lag_slots: Math.max(0, Math.round(2 + i * 0.3 + 1.5 * s(phase, 1 + i * 0.1))),
    })),

    attribution_heatmap: RPC_SOURCES.map((r, i) => ({
      source: r.source,
      consistent: 80 + Math.round(15 * c(phase, 1 + i * 0.2)),
      slot_skew:  Math.max(0, Math.round(4 + 3 * s(phase, 1 + i * 0.3))),
      content_divergence: Math.max(0, Math.round(2 + 1.5 * s(phase, 1 + i * 0.2))),
      outlier_share_bps:  Math.max(0, Math.round(40 + 30 * s(phase, 1 + i * 0.4))),
    })),

    network_tps_p50: 3_200 + Math.round(280 * s(phase)),
    network_tps_p99: 4_100 + Math.round(360 * c(phase)),

    jito_landed_rate_bps_1m: 7_200 + Math.round(420 * s(phase, 0.5)),

    validator_latency_by_region: VALIDATOR_REGIONS.map((region, i) => ({
      region,
      p99_ms: 240 + i * 40 + Math.round(80 * s(phase, 1 + i * 0.15)),
    })),

    cu_p50_per_rebalance: 380_000 + Math.round(20_000 * s(phase)),
    cu_p99_per_rebalance: 920_000 + Math.round(80_000 * c(phase)),

    proof_gen_p50_ms: 18_500 + Math.round(2_800 * s(phase)),
    proof_gen_p99_ms: 56_000 + Math.round(8_500 * c(phase)),

    rebalance_e2e_p50_ms: 32_000 + Math.round(3_500 * s(phase)),
    rebalance_e2e_p99_ms: 78_000 + Math.round(9_000 * c(phase)),

    pyth_post_latency_p99_ms: 540 + Math.round(120 * s(phase, 1.5)),

    bundles_landed_5m:    540 + Math.round(40 * s(phase)),
    bundles_attempted_5m: 720 + Math.round(30 * c(phase)),

    tps: {
      true_tps:        3_400 + Math.round(450 * s(phase)),
      vote_removed_tps: 2_100 + Math.round(220 * c(phase)),
      sample_age_ms: 800,
    },

    freshness_budgets: [
      { vault_id: "ab12cdef" + "0".repeat(56), slot_drift:  4, freshness_remaining_slots: 124, band: "green" },
      { vault_id: "01a02b03" + "0".repeat(56), slot_drift: 11, freshness_remaining_slots:  72, band: "amber" },
      { vault_id: "ff10ee20" + "0".repeat(56), slot_drift:  6, freshness_remaining_slots: 102, band: "green" },
      { vault_id: "deadbeef" + "0".repeat(56), slot_drift: 18, freshness_remaining_slots:  18, band: "red"   },
    ],
  };
}
