# Game-day runbook — Pyth Hermes degraded (50 % post failure)

Half of Pyth pull-oracle posts fail to land. Bundles missing a fresh
price update revert atomically per directive 07 §8.

## Pre-flight

- Kill switch: scenario halts if `atlas_pyth_post_first_ix_violations_total`
  exceeds 5 in 1 minute.
- Channel: #atlas-chaos.

## Inject

```sh
atlas-chaos run --scenario pyth-hermes-degraded --target staging --seed 12346 --output reports/gameday-pyth.json
```

`PythPullPostFail miss_rate_bps=5_000` halves the post success rate
on the keeper side.

## Observe

1. `atlas_ovl_stale_pyth_total` rate climbs.
2. Bundles where the post failed revert atomically — bundle-id is not
   recorded; on-chain root is unchanged.
3. Defensive vector engages; capital collapses to idle while Pyth
   recovers.
4. `Notify` alert fires.

## Recover

1. Confirm defensive vector. Atlas SHOULD NOT auto-retry — the
   `atlas-pyth-post::verify_freshness` gate refuses any post older
   than 4 slots, so retry without a fresh post is futile.
2. Trigger the keeper-side `keeper-pyth-post` job manually for a
   subset of feeds; observe `atlas_ovl_stale_pyth_total` flat-line.
3. Once Pyth recovers, defensive vector auto-clears after 8 slots of
   `atlas_ovl_consensus_confidence_bps ≥ 7_000`.

## Debrief

Track Pyth's mainnet observed reliability against the chaos miss-rate
to validate the threshold. If MTTR exceeds 600 s the keeper-side
retry policy needs tightening (Phase 02 §3).
