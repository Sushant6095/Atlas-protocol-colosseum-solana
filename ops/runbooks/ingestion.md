# Runbook — Ingestion failures (1xxx)

Covers `QuorumDisagreement`, `SourceQuarantined`, `RpcTimeout`, `StaleAccount`.

## Triage

1. Look at `atlas_ingest_quorum_match_rate_bps` — anything < 9_950 is the
   first signal.
2. Cross-reference `atlas_ingest_source_quarantined_total` to see which
   sources fell below the EMA threshold.
3. Check `atlas_ingest_event_lag_slots p99` — values > 8 slots mean the
   sources we still trust are also degraded.

## Decision tree

| Class | Action |
|---|---|
| `QuorumDisagreement { hard: true }` | Halt rebalance, page oncall. Quarantine the disagreeing source. Do not retry until match rate ≥ 9_950 for 8 consecutive slots. |
| `QuorumDisagreement { hard: false }` | Defensive vector. Auto-recover when match rate restored. |
| `SourceQuarantined` | No action; the engine handles fan-out. Verify `atlas_ingest_source_quarantined_total` is rolling. If a third source quarantines we lose quorum — this becomes hard quorum. |
| `RpcTimeout` | Failover to the next provider. If all providers timeout, hard quorum disagreement. |
| `StaleAccount` | Re-fetch with `Commitment::Confirmed`. If repeated, the account is gone or the RPC is forked — escalate. |

## Recovery

Source reliability EMA recovers automatically after 32 slots of agreeing
reads. No manual reset is required.
