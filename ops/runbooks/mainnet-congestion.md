# Game-day runbook — Mainnet congestion (10× tip required)

Network is heavily congested. The tip required for landing rises 10×
within minutes. Bundle landed-rate falls below SLO.

## Pre-flight

- Kill switch: scenario halts if the `TipOracle` recommendation
  exceeds the per-vault 24h cap (`TipCap.max_per_24h_lamports`); at
  that point the keeper stops bidding.
- Channel: #atlas-chaos.

## Inject

```sh
atlas-chaos run --scenario mainnet-congestion --target staging --seed 12348 --output reports/gameday-congestion.json
```

`BundleNotLanded miss_rate_bps=9_500` simulates 95 % bundle drop —
chosen above the 90 % threshold so the directive's 95 % SLO is
demonstrably broken.

## Observe

1. `atlas_runtime_bundle_landed_rate_bps` collapses.
2. The `TipOracle` reacts: rolling-window p75 escalates; `next_tip`
   recommendation rises until the per-bundle cap clamps.
3. The dual-route `RegionEma` updates landed-rate-per-region; the
   keeper rotates to the highest-rate region.
4. `Notify` alert fires (sustained drop). Page only when the cap
   gate engages and we can no longer bid.

## Recover

1. If the cap engages and bundles still don't land, halt new
   rebalances. The system stops bidding rather than overpaying.
2. Operator inspects the leader-slot tip distribution: if the median
   is sustainably above our cap, governance raises the cap (per-vault,
   audited). Otherwise, wait it out.
3. When `atlas_runtime_bundle_landed_rate_bps` recovers to ≥ 9_500
   for 8 slots, rebalances re-engage.

## Debrief

Validate the 24h tip cap against actual realised tip spend across
the chaos run — if we hit the cap, the cap may be too low; if we
were nowhere near it, the cap might be too generous. Either way, a
governance proposal is the only mechanism to change it.
