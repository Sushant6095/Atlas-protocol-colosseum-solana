# Runbook — Oracle failures (2xxx)

Covers `OracleStale`, `OracleDeviation`, `PythPullPostFailed`.

## Triage

1. `atlas_ovl_consensus_confidence_bps` per asset — green ≥ 7_000.
2. `atlas_ovl_deviation_bps p99` — yellow ≥ 80, red ≥ 200.
3. `atlas_ovl_stale_pyth_total` — any non-zero rate is a freshness gate
   firing.

## Decision tree

| Class | Action |
|---|---|
| `OracleStale` (Pyth) | Trigger `keeper-pyth-post`. After post, retry the rebalance. If post itself fails → `PythPullPostFailed`. |
| `OracleStale` (Switchboard or TWAP) | Defensive vector — Pyth alone is not sufficient confidence. |
| `OracleDeviation { deviation_bps > 200 }` | Defensive vector immediately; do NOT auto-retry. The deviation must clear for 8 slots before the engine re-engages. |
| `PythPullPostFailed` | Halt and page. The keeper is broken; without it the freshness gate cannot recover. |

## Anti-patterns

- Do not bypass the freshness gate in code. The on-chain verifier reasserts
  it; bypassing off-chain only delays the on-chain reject.
- Do not treat CEX prices (Birdeye) as oracle inputs. They are guard-rail
  references, not commitment inputs (see `atlas_ovl::cex_guard`).
