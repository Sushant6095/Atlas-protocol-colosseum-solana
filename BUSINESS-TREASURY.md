# Atlas Treasury OS for Internet Businesses

> Businesses hold stablecoins in Atlas. Idle capital is autonomously
> deployed across audited DeFi venues with zk-verified rebalances.
> Payouts settle instantly worldwide via Dodo Payments. Liquidity is
> pre-warmed before scheduled outflows. Every allocation and every
> payout is cryptographically auditable.

## What Phase 13 ships

| Surface | Crate / Code |
|---|---|
| Business identity (KYB hash + role-bound roster) | `crates/atlas-payments/src/business.rs` |
| Dodo webhook ingest (HMAC + replay) | `crates/atlas-payments/src/dodo.rs` |
| Pre-warm engine (split / defer / alert) | `crates/atlas-payments/src/prewarm.rs` |
| Cashflow runway forecast (p10 / p50) | `crates/atlas-payments/src/runway.rs` |
| Invoice intelligence (open AR + settlement distribution) | `crates/atlas-payments/src/invoice.rs` |
| 4 new public API endpoints | `crates/atlas-public-api/src/endpoints.rs` |
| `client.get_runway` + `client.get_payment_schedule` | `crates/atlas-rs/src/client.rs` |
| 8 Phase 13 telemetry metrics | `crates/atlas-telemetry/src/lib.rs` |
| `/payments` playground | `sdk/playground/payments.html` |

## The hard rule (§1)

Dodo API output **never** enters a Poseidon commitment path. Payment
schedules, invoices, KYB attestations, runway forecasts are
*scheduling metadata* — they trigger pipeline runs, they are never
inputs to the proof. Strategy commitments (Phase 01 I-1), risk
topology (Phase 04 §3), and feature vectors (Phase 01 stage 03) remain
sourced from on-chain accounts and validated oracles only.

## Construct

### Business identity

`BusinessTreasury` extends Phase 10's `TreasuryEntity` with:

- KYB attestation hash (Dodo signs off-chain; Atlas commits the hash
  on-chain at creation).
- `payment_account_id` (Dodo account that originates payouts).
- `SignerRoster` with role-bound caps (CEO / CFO / Treasurer /
  Operator / ReadOnly). Above the role's cap, payouts require multisig
  quorum.

The roster is part of the strategy commitment — immutable
post-creation. Changing it means migrating to a new entity.

### Pre-warm engine

Dodo notifies Atlas of upcoming outflows via signed webhook. The
pre-warm engine plans a response per intent:

| Priority | Decision (in order) |
|---|---|
| Critical | always `SingleRebalance` — no APY-cap dodge |
| High | `SingleRebalance` while under cap → else `Split { steps: 4 }` |
| Normal / Low | `Deferred { defer_slots }` within the intent's band → else `AlertConstraintViolation` |

Atlas never silently misses a `latest_at_slot`. If pre-warm cannot
meet the deadline within policy, the multisig is alerted in advance.

### Runway forecast

`runway_p10_days` is the worst-case (10th percentile) days of runway
given the outflow distribution. Risk engine constraint tiers:

| Tier | p10 days |
|---|---|
| Healthy | ≥ 180 |
| Cautious | 90 – 180 |
| Constrained | 30 – 90 |
| Critical | < 30 |

The signal can only **tighten** allocation. Loosening would let
off-chain Dodo data weaken the proof's guarantees.

### Invoice intelligence

Open AR feeds the runway forecast. The settlement distribution is
amount-weighted across all open invoices so a single large invoice
with slow settlement appropriately drags the forecast.

## Adversarial cases handled

| Attack | Defense |
|---|---|
| Forged schedule | HMAC verification against the treasury's registered Dodo key |
| Replay | `IntentDedup` rejects duplicate `intent_id` |
| Schedule manipulation by compromised webhook source | Above-cap payouts still need the role's multisig quorum |
| Stale payload | `MAX_WEBHOOK_AGE_SECONDS = 600` |
| Inverted window | `earliest_at_slot ≥ latest_at_slot` rejects |
| Trainer / treasurer self-authorise | Role caps + multisig quorum above cap |
| Off-chain data weakening proof | Runway can only tighten; never loosens |

## Anti-patterns

- "Pay" button with no pre-warm. The track wants liquidity ready
  before scheduled outflows, not at scheduled outflows.
- KYB stored on-chain in plaintext. Atlas commits the hash; the
  signed payload lives off-chain.
- Above-cap payout signed by a single role. The multisig quorum is
  the line that protects business funds against a compromised role
  key.
- Loosening allocation based on a long runway forecast. Off-chain
  data can only tighten.

## Positioning

> **Atlas Treasury OS** — internet-business treasury with
> zk-verified rebalances, instant global payouts via Dodo, liquidity
> pre-warmed before scheduled outflows, runway-aware allocation that
> tightens when cash is short. Multisig-governed. Every allocation
> and every payout is cryptographically auditable.
