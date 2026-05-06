# Game-day runbook — Drift program upgrade with breaking ABI change

Drift mainnet upgrades; one ix's account layout changes silently.
Atlas's CPI hits `AccountDataDeserializationError`.

## Pre-flight

- Kill switch: scenario halts if `atlas_runtime_cpi_post_condition_violations_total`
  fires more than 10 times in 5 minutes (this would indicate a
  staging/prod schema diff that's NOT just the upgrade).
- Channel: #atlas-chaos.

## Inject

```sh
atlas-chaos run --scenario drift-abi-break --target staging --seed 12347 --output reports/gameday-drift.json
```

`CpiFailure protocol=Drift after_n_slots=0
error="AccountDataDeserializationError"` triggers immediate failure
on the first Drift CPI.

## Observe

1. Bundle aborts atomically. No state mutation; vault state pinned
   to before-hash.
2. `atlas_cpi_failure_total{protocol="drift"}` rate climbs.
3. The forensic engine records a `5xxx CpiFailure` Phase 05
   classification with full pre/post snapshot diff.
4. `Notify` alert fires (`AlertKind::DefensiveModeEntered` —
   isolated CPI failure does not auto-page; sustained failure does).

## Recover

1. Quarantine Drift in the protocol allowlist (Phase 04 ProtocolId
   gate).
2. Capital reroutes around Drift via the consensus algorithm.
3. Engineering fix: update Atlas's Drift IDL in
   `crates/atlas-rebalancer/src/cpi/drift.rs`, push, deploy.
4. Re-enable Drift one vault at a time.

## Debrief

Schedule a post-mortem on why we didn't catch the upgrade earlier —
Drift posts changelogs to a public channel; the chaos team should
own a webhook that escalates on any release tag.
