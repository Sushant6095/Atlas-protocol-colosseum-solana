# Atlas Autonomous Execution Engine — Jupiter Composition

> Proof-gated spot, contingent, recurring, and hedge execution composed
> across Jupiter. Every order, every cadence change, every hedge resize
> is cryptographically verifiable on-chain.

## What Phase 12 ships

| Surface | Crate / Code |
|---|---|
| Proof-gated trigger orders (5 types) | `crates/atlas-trigger-gate/` |
| Adaptive DCA over Jupiter Recurring | `crates/atlas-recurring-plan/` |
| Jupiter Lend integration + Perps hedge sizing | `crates/atlas-jupiter/` |
| `pusd-jupiter-lend-conservative` template | `crates/atlas-vault-templates/` (TemplateId) |
| 4 new Jupiter program ids in CPI allowlist | `crates/atlas-cpi-guard/src/allowlist.rs` |
| Predictive 3-slot quote routing penalty | `crates/atlas-execution-routes/src/predictive.rs` |
| `client.create_gated_trigger` + `client.open_adaptive_recurring` | `crates/atlas-rs/src/client.rs` |
| `/api/v1/triggers`, `/api/v1/recurring`, `/api/v1/hedging/preview` | `crates/atlas-public-api/src/endpoints.rs` |
| 8 Phase 12 telemetry metrics | `crates/atlas-telemetry/src/lib.rs` |
| `/triggers` + `/recurring` playground | `sdk/playground/triggers.html`, `recurring.html` |

## The flagship construct: zk-verified contingent execution

A normal Jupiter trigger fires on price. An Atlas-gated trigger fires
on price **and** on a cryptographically-attested system-state predicate
the user signed off on at trigger creation.

```text
TriggerOrderV2     (Jupiter program)
       ▲ delegated authority
       │
TriggerGate        (atlas program) ──── conditions_hash (immutable)
       ▲ CPI on execution
       │
Jupiter keeper ──► gate_check(attestation, registered_authority, current_slot)
                          │
                          ├── stale attestation        ─► REJECT
                          ├── wrong vault              ─► REJECT
                          ├── wrong conditions_hash   ─► REJECT
                          ├── spoofed authority        ─► REJECT
                          ├── malformed signature      ─► REJECT
                          └── expired gate             ─► REJECT
                                       │
                                       └── all pass    ─► ALLOW (Jupiter consumes the trigger)
```

5 trigger types (`TRIGGER_ORDER_TYPES`):

1. `StopLoss` — gated by `PegDeviationBelow + RegimeNotCrisisAndOracleFresh`
2. `TakeProfit` — gated by `RegimeNotCrisisAndOracleFresh`
3. `OcoBracket` — pair of triggers, gated by `RegimeNotCrisisAndOracleFresh + VaultDefensiveModeFalse`
4. `RegimeExit` — fires when `RegimeNotCrisisAndOracleFresh` becomes false
5. `LpExitOnDepthCollapse` — gated by `LpDepthAbove + ProtocolUtilizationBelow`

## Adaptive DCA (Jupiter Recurring + AI-modulated cadence)

Every parameter change to a `RecurringPlan` is proof-gated:

```text
RecurringPlan v1   ──► first proven by initial vault rebalance
   │
   ├─ regime shift ──► Atlas pipeline produces RecurringPlan v2 with proof
   │                   ──► update_recurring_plan ix verifies proof + bounds
   │
   ▼
Jupiter Recurring program reads RecurringPlan; executes next slice
```

Strategy commitment bounds (immutable post-creation):

- `max_slice_notional_q64`
- `min_interval_slots`, `max_interval_slots`
- `slippage_budget_cap_bps`

The AI cannot exceed these. Exceeding them in a proof attempt fails
verification (`atlas_recurring_plan::plan::validate_plan_update`).

Regime → cadence map (`cadence_for_regime`):

| Regime | Slice mul | Interval mul | Slippage mul | Paused |
|---|---|---|---|---|
| Accumulation | 1.5× | 0.5× | 0.8× | no |
| Calm | 1.2× | 0.8× | 0.8× | no |
| Neutral | 1.0× | 1.0× | 1.0× | no |
| HighVol | 0.5× | 1.5× | 1.2× | no |
| Panic | 0.25× | 2.5× | 0.6× | no |
| Crisis | 0× | 0× | 0× | **yes** |

## Hedging

Hedge notional is **derived**, never user-supplied. The naked-short guard
rejects any `proposed_hedge_notional_q64 > underlying_lp_value_q64`.
Leverage capped at `RECOMMENDED_MAX_LEVERAGE_BPS = 20_000` (2×).

## Hard rules

1. Jupiter Quote / Price / Trigger / Recurring read output **never**
   enters a Poseidon commitment path. Routes are quoted live for
   execution; quoted prices are sanity guards, not commitment inputs.
2. A Jupiter Trigger created with a user EOA as authority is forbidden.
   Atlas-gated triggers must be authority'd by a `TriggerGate` PDA.
3. There is no "small update" exception for the recurring plan.
   Every parameter change is proven.
4. Hedge sizing is derived from the underlying LP exposure, never
   user-supplied.
5. Trigger conditions are limited to predicates the verifier can
   evaluate from on-chain accounts and validated oracles. No off-chain
   Birdeye / Dune state.

## Demo flow

1. Create a stop-loss on a PUSD vault via `/triggers`.
2. Inject an oracle anomaly via the chaos harness (Phase 08
   `OracleStale hold_slots=50`). The corresponding Atlas attestation
   does not get re-signed; existing attestation goes stale.
3. Jupiter keeper attempts to fire the trigger; `gate_check` rejects
   on `Stale` (lag > 8 slots).
4. Recover the oracle. Atlas posts a fresh attestation. Re-fire the
   trigger; gate passes; Jupiter consumes the trigger.

For adaptive DCA: open a recurring buy, inject a regime shift, observe
the on-chain `RecurringPlan` update via a new proof; the next Jupiter
Recurring slice executes under new parameters.

## Positioning

> **Atlas Autonomous Execution Engine** — proof-gated spot, contingent,
> recurring, and hedge execution composed across Jupiter. Triggers that
> refuse to fire during oracle anomalies. Recurring buys that pause
> themselves on regime shifts. Hedges that cannot exceed their
> underlying.
