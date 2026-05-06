# Game-day runbook — Bubblegum anchor keeper key loss

The keeper key controlling the `atlas_archive` PDA is lost or
compromised. Receipt anchoring (Phase 03 + Phase 07 §5) is broken
until the key is rotated.

## Pre-flight

- Kill switch: scenario halts if the receipt-tree root advances on
  staging despite chaos engagement (would indicate the chaos isn't
  actually blocking the archive path).
- Channel: #atlas-chaos.
- **CRITICAL**: this scenario MUST run against staging only. The
  chaos crate's compile-time mainnet guard enforces this; double-check
  the binary build did not enable the
  `INTENTIONAL_MAINNET_OVERRIDE_DO_NOT_USE` feature.

## Inject

```sh
atlas-chaos run --scenario bubblegum-keeper-loss --target staging --seed 12350 --output reports/gameday-keeper-loss.json
```

The scenario stalls the archive RPC source for 60 s, which prevents
the Bubblegum flusher (Phase 03) from anchoring receipts.

## Observe

1. `atlas_warehouse_bubblegum_anchor_lag_slots p99` climbs past 600.
2. Per directive Phase 01 I-8, the rebalance ix refuses to submit
   without an archival receipt — the pipeline HALTS.
3. The alert engine PAGES (`AlertKind::ArchivalFailure` /
   `AlertKind::ProverNetworkDown` depending on which side fails
   first).
4. No new on-chain root commitments. Vault state is frozen at the
   last good rebalance.

## Recover

1. Governance executes the pre-signed key-rotation transaction (the
   `atlas_archive` PDA's authority change is a `RegistryAnchor` —
   atlas-governance crate). This is a multisig governance flow, not
   a unilateral keeper change.
2. The new keeper signs a `record_rb` ix with a fresh keeper-key on
   the next rebalance to confirm the archival path is restored.
3. Drain the backlog: rebalances that were in flight when the key
   was lost are NOT re-attempted automatically; the operator
   re-submits each one with the same `bundle_id` and the
   IdempotencyGuard ensures double-recording never happens.

## Debrief

Pin a TODO to make the key-rotation flow a one-click governance ix
(directive 06 §3.2 anchoring). Validate that the multisig threshold
is set correctly — too high and recovery takes hours; too low and a
single signer compromise loses the key.
