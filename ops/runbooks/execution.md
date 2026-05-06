# Runbook — Execution failures (5xxx)

Covers `ComputeExhaustion`, `CpiFailure`, `SlippageViolation`,
`PostConditionViolation`, `BundleNotLanded`, `AltMissingAccount`.

## Triage

1. `atlas_rebalance_cu_total p99` — SLO ≤ 1.2 M, hard cap 1.4 M.
2. `atlas_cpi_failure_total{protocol}` — rate above 0.5 % of bundles.
3. `atlas_verifier_cu p99` — SLO ≤ 280 k.
4. Bundle landing rate from the executor span — anything below 95 % is
   a `BundleNotLanded` precursor.

## Decision tree

| Class | Action |
|---|---|
| `ComputeExhaustion` | Refresh the CU forecast and segment the bundle. Retry once. If the predicted CU is still above the cap, halt and surface to the operator. |
| `CpiFailure { protocol }` | Revert. If the protocol is in maintenance, retry on the next slot. Otherwise emit a `Notify` and let the next rebalance window pick up. |
| `SlippageViolation` | Revert; narrow the route (smaller chunks, alternative pools) and retry once. Two consecutive slippage violations on the same pair → quarantine the pair for the rest of the epoch. |
| `PostConditionViolation` | Revert and PAGE. The bundle violated an invariant — never auto-retry until the operator confirms the invariant catalogue is still applicable. |
| `BundleNotLanded` | Bump the tip and retry. Two failures → defensive vector. |
| `AltMissingAccount` | Re-derive the ALT and retry once. Persistent failure means the ALT is corrupt — escalate. |

## Anti-patterns

- Do not retry `PostConditionViolation` automatically. The invariant
  catalogue exists for a reason; surface it to a human.
- Do not raise the CU cap to silence `ComputeExhaustion`. The cap is the
  contract with the leader.
