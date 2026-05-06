# Game-day runbook — Total Helius outage

Yellowstone gRPC + webhooks both unreachable. Atlas's primary
ingestion source vanishes.

## Pre-flight

- Declare scenario in #atlas-chaos.
- Kill switch: scenario halts if `atlas_ingest_quorum_match_rate_bps`
  drops below 5_000 for 4 consecutive minutes.
- Communication channel: #atlas-chaos only. No DMs to chaos engineer.

## Inject

```sh
atlas-chaos run --scenario helius-outage --target staging --seed 12345 --output reports/gameday-helius.json
```

The scenario fires `RpcDrop` and `WebsocketReset` against
`SourceId(1)` (Yellowstone) and `SourceId(2)` (webhooks).

## Observe

Expected progression:

1. `atlas_ingest_event_lag_slots p99` climbs above 8.
2. `atlas_ingest_source_quarantined_total` increments for both
   sources.
3. Quorum reliability drops; `atlas_ingest_quorum_match_rate_bps`
   falls below 9_950.
4. Defensive vector engages within 8 slots; capital shifts to idle
   per the directive vector.
5. `Notify` alert fires through the alert engine
   (`AlertKind::DefensiveModeEntered`).

## Recover

1. Confirm defensive vector is active.
2. Failover to the secondary RPC pool (Triton + Quicknode) by
   updating the warehouse config; quarantined sources stay
   quarantined until the EMA recovers.
3. Once `atlas_ingest_source_quarantined_total` flat-lines for 32
   slots, re-enable the primary path one source at a time.
4. Re-run `atlas-chaos run --scenario helius-outage` against staging
   with no chaos active to confirm shadow drift is 0.

## Debrief

Reconstruct the timeline from the warehouse `events` table; capture
TODOs for any runbook gap. Pin MTTD < 60 s and MTTR < 600 s per the
directive §6 SLOs.
