// Decision engine fixtures — 10 agents in 3 layers, signal flows L→R.
//
// Layer 1 (sensors)  : Oracle, Exposure, Fee, Liquidity, MEV, Anomaly
// Layer 2 (deciders) : PolicyGate, Aggregator, TriggerGate
// Layer 3 (executor) : Rebalancer
//
// 12 edges total: 6 sensors fan into 2 deciders (PolicyGate, Aggregator,
// TriggerGate selectively) + 3 deciders → Rebalancer + 1 Anomaly refusal
// path. The single edge from Aggregator → Rebalancer is the proof-bearing
// link (rendered accent.proof pink); every other edge is accent.electric.

export type AgentStatus = "PASS" | "WATCH" | "REFUSE";
export type AgentLayer = "sensor" | "decider" | "executor";

export interface AgentNode {
  id: string;
  name: string;
  layer: AgentLayer;
  status: AgentStatus;
  latencyMs: number;
  lastRunAt: string; // ISO
  reasoning: string[]; // 3-5 lines
  recentDecisions: { ts: string; verdict: AgentStatus; rationale: string }[];
  sourceCrate: string; // e.g. "atlas-oracle"
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  /** Proof-bearing edges render with accent.proof. */
  proof?: boolean;
  /** Refusal path renders with accent.danger. */
  refusal?: boolean;
}

export const AGENTS: AgentNode[] = [
  // ── Sensors ────────────────────────────────────────────────────
  {
    id: "oracle",
    name: "Oracle",
    layer: "sensor",
    status: "PASS",
    latencyMs: 42,
    lastRunAt: "2026-05-11T14:32:11Z",
    sourceCrate: "atlas-oracle",
    reasoning: [
      "Pyth + Switchboard quorum agree within 8 bps on SOL/USDC.",
      "Confidence interval 0.04% — well below 0.25% trigger band.",
      "Stale slot delta: 2 (max allowed 32).",
    ],
    recentDecisions: [
      { ts: "14:32:11", verdict: "PASS",  rationale: "Quorum tight; confidence band nominal." },
      { ts: "14:30:44", verdict: "PASS",  rationale: "Switchboard re-synced after 1-slot drift." },
      { ts: "14:28:09", verdict: "WATCH", rationale: "Pyth confidence widened briefly to 0.18%." },
    ],
  },
  {
    id: "exposure",
    name: "Exposure",
    layer: "sensor",
    status: "PASS",
    latencyMs: 31,
    lastRunAt: "2026-05-11T14:32:12Z",
    sourceCrate: "atlas-exposure",
    reasoning: [
      "Per-protocol cap utilization: Kamino 64%, Drift 38%, Jupiter 41%.",
      "No single venue above the 75% policy ceiling.",
      "Cross-venue correlation regime: low (0.22).",
    ],
    recentDecisions: [
      { ts: "14:32:12", verdict: "PASS",  rationale: "All venues under cap." },
      { ts: "14:25:00", verdict: "PASS",  rationale: "Kamino utilization stepped down 3 pts." },
      { ts: "14:18:21", verdict: "WATCH", rationale: "Drift breached 70% briefly during rebalance." },
    ],
  },
  {
    id: "fee",
    name: "Fee",
    layer: "sensor",
    status: "WATCH",
    latencyMs: 28,
    lastRunAt: "2026-05-11T14:32:09Z",
    sourceCrate: "atlas-fee",
    reasoning: [
      "Compute-unit price p75 ticked from 18k → 24k microlamports.",
      "Inclusion-cost projection over next 5 slots: $0.0042/tx.",
      "Below the 0.01 USDC ceiling, but flagged for tracking.",
    ],
    recentDecisions: [
      { ts: "14:32:09", verdict: "WATCH", rationale: "Priority lane fees up 33% in last 30s." },
      { ts: "14:31:02", verdict: "PASS",  rationale: "Median CU price stable." },
      { ts: "14:29:55", verdict: "PASS",  rationale: "Network congestion nominal." },
    ],
  },
  {
    id: "liquidity",
    name: "Liquidity",
    layer: "sensor",
    status: "PASS",
    latencyMs: 36,
    lastRunAt: "2026-05-11T14:32:10Z",
    sourceCrate: "atlas-liquidity",
    reasoning: [
      "Depth-1pct across all legs ≥ 5× planned rebalance notional.",
      "Slippage projection: 2.4 bps (under 10 bps ceiling).",
      "No venue is liquidity-starved within the 30s lookback.",
    ],
    recentDecisions: [
      { ts: "14:32:10", verdict: "PASS",  rationale: "5.4× depth headroom, 2.4 bps slippage." },
      { ts: "14:30:00", verdict: "PASS",  rationale: "Concentration ratios within band." },
      { ts: "14:27:14", verdict: "WATCH", rationale: "Jupiter LP TVL dropped briefly." },
    ],
  },
  {
    id: "mev",
    name: "MEV",
    layer: "sensor",
    status: "PASS",
    latencyMs: 44,
    lastRunAt: "2026-05-11T14:32:08Z",
    sourceCrate: "atlas-mev",
    reasoning: [
      "Sandwich detector idle over last 12 slots.",
      "Jito bundle inclusion rate 96% on Atlas RPC pool.",
      "Backrun risk score: 0.07 (threshold 0.40).",
    ],
    recentDecisions: [
      { ts: "14:32:08", verdict: "PASS",  rationale: "Clean lane, no sandwich attempts." },
      { ts: "14:31:30", verdict: "PASS",  rationale: "Bundle landed in first attempt." },
      { ts: "14:26:42", verdict: "WATCH", rationale: "Backrun probe seen on Drift leg." },
    ],
  },
  {
    id: "anomaly",
    name: "Anomaly",
    layer: "sensor",
    status: "REFUSE",
    latencyMs: 51,
    lastRunAt: "2026-05-11T14:32:13Z",
    sourceCrate: "atlas-anomaly",
    reasoning: [
      "Cross-venue divergence on Jupiter price oracle: 3.4σ.",
      "Pattern matches the 2025-12 mirror-feed drift incident.",
      "Defensive vote: hard veto until divergence < 1σ for 3 slots.",
    ],
    recentDecisions: [
      { ts: "14:32:13", verdict: "REFUSE", rationale: "Oracle divergence 3.4σ — refusal floor engaged." },
      { ts: "14:31:00", verdict: "WATCH",  rationale: "Divergence rising; pre-warn issued." },
      { ts: "14:28:34", verdict: "PASS",   rationale: "Pattern normal." },
    ],
  },

  // ── Deciders ───────────────────────────────────────────────────
  {
    id: "policy",
    name: "PolicyGate",
    layer: "decider",
    status: "PASS",
    latencyMs: 19,
    lastRunAt: "2026-05-11T14:32:14Z",
    sourceCrate: "atlas-policy",
    reasoning: [
      "Strategy commitment matches the immutable on-chain Poseidon hash.",
      "Region + sanctions allowlist clears for all destination ATAs.",
      "Disclosure policy folded into the public input commitment.",
    ],
    recentDecisions: [
      { ts: "14:32:14", verdict: "PASS", rationale: "Manifest match; legs within scope." },
      { ts: "14:30:01", verdict: "PASS", rationale: "Policy version unchanged since deploy." },
      { ts: "14:25:55", verdict: "PASS", rationale: "Region check clean." },
    ],
  },
  {
    id: "aggregator",
    name: "Aggregator",
    layer: "decider",
    status: "PASS",
    latencyMs: 24,
    lastRunAt: "2026-05-11T14:32:14Z",
    sourceCrate: "atlas-aggregator",
    reasoning: [
      "7-agent quorum: 5 PASS, 1 WATCH, 1 REFUSE.",
      "Refusal floor: 1/7 = veto. Defensive arm engaged.",
      "Hands SP1 proof obligation to Rebalancer with attenuated size.",
    ],
    recentDecisions: [
      { ts: "14:32:14", verdict: "WATCH", rationale: "Aggregated to defensive arm." },
      { ts: "14:30:30", verdict: "PASS",  rationale: "Quorum at 7/7; full size." },
      { ts: "14:28:00", verdict: "WATCH", rationale: "Aggregated under fee pressure." },
    ],
  },
  {
    id: "trigger",
    name: "TriggerGate",
    layer: "decider",
    status: "PASS",
    latencyMs: 17,
    lastRunAt: "2026-05-11T14:32:14Z",
    sourceCrate: "atlas-trigger",
    reasoning: [
      "Drift-threshold delta is 87 bps — above the 50 bps trigger.",
      "Cooldown window cleared (last fire 14:18:21, > 14 min ago).",
      "Trigger reason: yield-decay on Drift leg, opportunity on Kamino.",
    ],
    recentDecisions: [
      { ts: "14:32:14", verdict: "PASS",  rationale: "Trigger conditions met." },
      { ts: "14:30:30", verdict: "WATCH", rationale: "Inside cooldown — deferred." },
      { ts: "14:18:21", verdict: "PASS",  rationale: "Fired last rebalance." },
    ],
  },

  // ── Executor ───────────────────────────────────────────────────
  {
    id: "rebalancer",
    name: "Rebalancer",
    layer: "executor",
    status: "PASS",
    latencyMs: 86,
    lastRunAt: "2026-05-11T14:32:15Z",
    sourceCrate: "atlas-rebalancer",
    reasoning: [
      "Proof receipt 0xa1b…f29 verified by on-chain SP1 verifier.",
      "CPI sequence drift → kamino → jupiter built, simulate clean.",
      "Bundle handed to Jito for next-slot inclusion.",
    ],
    recentDecisions: [
      { ts: "14:32:15", verdict: "PASS", rationale: "Proof minted, tx landed slot 329857241." },
      { ts: "14:18:24", verdict: "PASS", rationale: "Proof minted, tx landed slot 329851604." },
      { ts: "13:51:09", verdict: "PASS", rationale: "Proof minted, tx landed slot 329845112." },
    ],
  },
];

export const EDGES: AgentEdge[] = [
  // Sensors → PolicyGate
  { id: "e-oracle-policy",     source: "oracle",     target: "policy" },
  { id: "e-exposure-policy",   source: "exposure",   target: "policy" },
  // Sensors → Aggregator (the consensus hub)
  { id: "e-oracle-agg",        source: "oracle",     target: "aggregator" },
  { id: "e-exposure-agg",      source: "exposure",   target: "aggregator" },
  { id: "e-fee-agg",           source: "fee",        target: "aggregator" },
  { id: "e-liquidity-agg",     source: "liquidity",  target: "aggregator" },
  { id: "e-mev-agg",           source: "mev",        target: "aggregator" },
  // Sensors → TriggerGate
  { id: "e-fee-trigger",       source: "fee",        target: "trigger" },
  { id: "e-liquidity-trigger", source: "liquidity",  target: "trigger" },
  // Deciders → Rebalancer (Aggregator carries the proof)
  { id: "e-policy-rebal",      source: "policy",     target: "rebalancer" },
  { id: "e-agg-rebal",         source: "aggregator", target: "rebalancer", proof: true },
  { id: "e-trigger-rebal",     source: "trigger",    target: "rebalancer" },
  // Refusal path: Anomaly bypasses deciders straight to executor as a veto
  { id: "e-anomaly-rebal",     source: "anomaly",    target: "rebalancer", refusal: true },
];

export const DECISION_METRICS = {
  decisionsToday: 248,
  proofsMinted: 142,
  refusalsCorrect: 17,
  avgDecisionMs: 1200,
};
