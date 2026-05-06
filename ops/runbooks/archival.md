# Runbook — Archival failures (6xxx)

Covers `ArchivalWriteFailed`, `BubblegumAnchorLag`.

## I-8: archival is mandatory

Per directive Phase 01 §I-8, an archival failure ABORTS the rebalance.
There is no "we'll write it later" option. If you cannot record the black
box, you cannot rebalance.

## Triage

1. `atlas_warehouse_archive_failure_total` — any non-zero is hard alert.
2. `atlas_warehouse_write_lag_ms p99` — SLO ≤ 800 ms.
3. `atlas_warehouse_bubblegum_anchor_lag_slots p99` — SLO ≤ 600.

## Decision tree

| Class | Action |
|---|---|
| `ArchivalWriteFailed` | Abort the rebalance and PAGE. Investigate the warehouse client — is ClickHouse degraded? Is the S3 endpoint returning 5xx? Is the schema migration incomplete? Resolve before re-enabling rebalances. |
| `BubblegumAnchorLag` | Notify only — the orchestrator will catch up on the next flush boundary. If lag exceeds 2_048 slots, escalate. |

## Anti-patterns

- Do not silently retry archival writes. The black box must be the
  authoritative source for "what happened on slot N" — any race that drops
  a record breaks the contract.
- Do not delete archival records on cleanup. They are append-only.
