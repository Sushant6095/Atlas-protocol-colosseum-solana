# Atlas Treasury for PUSD

> Autonomous, zk-verified treasury management for censorship-resistant
> stablecoin capital on Solana. PUSD-native. Multisig-governed. Every
> movement is provable.

## What it is

Atlas is an autonomous treasury OS for Solana. It puts an AI capital
allocator behind the same proof-gated rails the verifier program uses
on chain — every rebalance produces a Groth16 proof, every receipt is
anchored in a per-vault Bubblegum tree, every allocation decision can
be reproduced from the warehouse archive.

PUSD is Atlas's primary reserve asset. The PUSD treasury layer ships
three vault templates, a `/treasury` flow gated by a Squads
multisig, a "Treasury Checking" yield account with instant-withdraw
guarantees that *strengthen* under stress, and a `/proofs/treasury`
page where a third party verifies the latest rebalance proof in their
browser.

## Architecture in one diagram

```
            ┌────────────────────────────────────────────────────┐
            │                Treasury entity (Squads)             │
            │  RiskPolicy ─┐                                      │
            │              ├─► commitment_hash (immutable)        │
            │  SignerSet ──┘                                      │
            └────────────┬───────────────────────────────────────┘
                         │
              owns       ▼
                  ┌──────────────────┐
                  │  PUSD vault       │  template: pusd-safe-yield  │ pusd-yield-balanced │ pusd-treasury-defense
                  │  share mint       │  Token-2022: forbidden     │ TransferFeeConfig    │ MetadataPointer
                  │  receipt tree     │  extensions enforced       │ at fee_bps = 0       │ TokenMetadata
                  └─────────┬─────────┘
                            │
                            ▼
            Phase 01 pipeline → Groth16 proof → Bubblegum anchor
                            │
                            ├─► /api/v1/rebalance/{hash}/proof
                            └─► @atlas/sdk → client.verifyProof(...)
```

## What we ship for the side-track

| Deliverable | Status | Where |
|---|---|---|
| `atlas-assets` crate (PUSD mint + Token-2022 manifest + drift CI) | ✅ | `crates/atlas-assets/` + `bin/atlas-drift-check` |
| Three PUSD vault templates × 3 risk bands = 9 commitments | ✅ | `crates/atlas-vault-templates/` (`Pusd*` variants) |
| `TreasuryEntity` + Squads multisig wiring | ✅ | `crates/atlas-treasury/src/entity.rs` |
| PUSD Yield Account ("Treasury Checking") | ✅ | `crates/atlas-treasury/src/yield_account.rs` |
| `/proofs/treasury` static page with client-side verify | ✅ | `sdk/playground/treasury.html` |
| Stablecoin intelligence triggers (peg / flow / depth / issuer) | ✅ | `crates/atlas-treasury/src/intel.rs` |
| Defensive trigger ladder for stable vaults | ✅ | `crates/atlas-treasury/src/defensive.rs` |
| Multisig-queued emergency reserve pull | ✅ | `crates/atlas-treasury/src/emergency.rs` |
| Cross-stable router with peg-deviation guards | ✅ | `crates/atlas-treasury/src/stable_swap.rs` |
| Stablecoin intelligence dashboard | ✅ | `sdk/playground/intel.html` |
| 6 PUSD-specific telemetry metrics | ✅ | `crates/atlas-telemetry/src/lib.rs` |

## Hard rules

1. **PUSD is the default reserve, not a checkbox.** No PUSD-native
   vault → no "we support PUSD" claim.
2. **Atlas is non-custodial.** Emergency reserve pulls are
   multisig-queued, never auto-signed.
3. **Token-2022 censorship-resistance is non-negotiable.** Permanent
   delegate, freeze authority, transfer hook → CI fails the merge.
4. **Peg deviation is a defensive trigger, not advisory.** 50 bps × 8
   slots → defensive immediately.
5. **PoR without a verifier is marketing.** Every page that claims
   reserves has a `verifyProof` button that runs the SDK shape check
   client-side and hands the proof to the on-chain `sp1-solana`
   verifier ix for the cryptographic guarantee.
6. **No third-party API output enters a Poseidon commitment path.**
   Birdeye-derived peg quotes are sanity guards. The commitment-bound
   peg signal is computed from on-chain DEX TWAPs (Phase 04 §2.1).

## Demo URLs

| Surface | URL pattern |
|---|---|
| Treasury proof of reserve | `/proofs/treasury` (`sdk/playground/treasury.html` while we're not deployed) |
| Stablecoin intel dashboard | `/intel` (`sdk/playground/intel.html`) |
| API playground | `/playground` (`sdk/playground/index.html`) |
| Public REST | `/api/v1/*` (catalog in `crates/atlas-public-api`) |
| Webhooks | `/api/v1/webhooks/*` — HMAC-SHA256, 600 s replay window |

## Code links

- GitHub: https://github.com/Sushant6095/Atlas-protocol-colosseum-solana
- Workspace: 36+ Rust crates spanning Phases 01-10
- Tests: 690+ (`cargo test --workspace`)
- SDKs: `@atlas/sdk` (TypeScript) + `atlas-rs` (Rust client)

## Audit posture

- Strategy commitments are content-addressed; mutating a vault's
  policy means creating a new vault and migrating capital under
  multisig governance.
- Every approved model + every approved template has a lineage chain
  validated by `atlas-registry::lineage::validate_lineage` (DAG, no
  cycles, exactly one genesis).
- Daily Token-2022 extension drift CI (`atlas-drift-check`) pages
  governance on any allowed-set change to the PUSD mint.
- Phase 06 governance flow requires three distinct keys (trainer,
  auditor, multisig) — trainer self-audit is rejected at the
  registry layer.
- Phase 07 §11 anti-pattern lints (`readonly-discipline`,
  `no-borsh-on-hot-path`, `disallowed-methods`,
  `forbid_third_party_in_commitment`) run on every PR.

## Runbooks

`ops/runbooks/` ships triage, decision tree, and recovery for every
`FailureClass` category plus the six mandatory game-day scenarios
including `bubblegum-keeper-loss.md` (the closest analog to a PUSD
issuer-event-driven freeze).

## Positioning one-liner

> **Atlas Treasury** — autonomous, zk-verified treasury management
> for censorship-resistant stablecoin capital on Solana. PUSD-native.
> Multisig-governed. Every movement is provable.
