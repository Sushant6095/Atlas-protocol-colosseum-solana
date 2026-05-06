# Runbook — Inference / Consensus failures (3xxx)

Covers `AgentTimeout`, `HardVeto`, `DisagreementOverThreshold`.

## Triage

1. `atlas_consensus_disagreement_bps` — sustained > 1_500 is the alert
   trigger.
2. Per-agent latency from the inference span — values that exceed the
   p99 SLO of 250 ms put the agent at risk of timeout on the next slot.

## Decision tree

| Class | Action |
|---|---|
| `AgentTimeout` | Exclude that agent and retry the consensus once. If it fails again, accept the consensus without it (one missing agent is recoverable; two is not). |
| `HardVeto { reason: TailRiskBreach }` | Reject the rebalance and emit a defensive vector instead. Do NOT retry. |
| `HardVeto` (other reasons) | Reject and surface to the operator dashboard. The proposal failed a hard guard, so the input must change before retry. |
| `DisagreementOverThreshold` | Defensive vector. Auto-recover when disagreement drops below 1_500 for 8 slots. |

## Anti-patterns

- Do not lower the disagreement threshold to silence the alert. The
  threshold is calibrated against historical regimes.
- Do not let a single agent have veto power without classification — every
  veto goes through `RejectionCode`.
