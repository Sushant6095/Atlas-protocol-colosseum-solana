# Atlas — Published Dune Queries

Pinned by `crates/atlas-intelligence/src/cohort.rs` as the canonical
cohort registry. The intelligence engine routes every cohort fetch
through these query ids; the snapshot store keeps the result
replayable byte-identical even if the underlying Dune dashboard is
edited.

| Cohort label | Query ID | Description |
|---|---|---|
| `top_stablecoin_holders` | `8100001` | Top 200 stablecoin holders, refreshed daily |
| `yield_rotators_90d` | `8100002` | Top 100 yield rotators by 90 d activity |
| `dao_treasuries` | `8100003` | DAO + protocol treasury wallets (Squads + similar) |
| `cross_chain_stable_movers` | `8100004` | Wallets shifting > $50k across Solana ↔ EVM in 30 d |

## How to publish

1. Sign in to Dune as the Atlas team account.
2. Save the query under the team account (so the URL is stable).
3. Wire the query id into `cohort_registry()` and bump the
   `COHORTS_MIN_REQUIRED` floor if needed.
4. Backlink the published query URL here in this table.

## Atlas-published Dune dashboard

In addition to the cohorts above, the Atlas team account publishes a
dashboard that renders **Atlas warehouse data through Dune SIM**, so
the joins go both ways:

- Solana side: warehouse rebalance receipts, exposure snapshots,
  forensic signal counts (proof-anchored, replay-parity holds).
- EVM side: Dune SIM cross-chain stablecoin flow joined to the same
  treasury entity ids.

Dashboard backlinks land in the operator README once the team
account is provisioned.

## Hard rule

These query ids never enter a Poseidon commitment path. The Phase
09 lint
(`atlas_runtime::lints::forbid_third_party_in_commitment`) refuses
any reference to `DuneSimSource`, `DuneQueryId`,
`WalletIntelligenceReport`, `CapitalFlowHeatmap`, `SmartCohort`, or
`QuerySnapshot` from `atlas_pipeline::canonical_json` or
`atlas_public_input` source files.

A Dune-augmented sandbox backtest cannot promote a model from
`Draft → Audited` (Phase 06 §3.1 +
`atlas_intelligence::backtest::audited_promotion_eligible`).
