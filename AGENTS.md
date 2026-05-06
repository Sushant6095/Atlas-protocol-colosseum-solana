# Atlas Operator Agent — Scoped Keepers, On-Chain Mandates, Independent Attestations

> Zerion-style policy-constrained treasury agents — but the policy is
> on-chain, the keepers each carry a distinct key, and "the agent
> moved funds without you" is structurally impossible to silence.

## What Phase 15 ships

| Surface | Crate / Code |
|---|---|
| Scoped keeper roles + per-action bitset (I-18) | `crates/atlas-operator-agent/src/role.rs` |
| Time- + value-bounded mandates with ratcheting (I-19) | `crates/atlas-operator-agent/src/mandate.rs` |
| Off-chain mirror of `atlas_keeper_registry` | `crates/atlas-operator-agent/src/registry.rs` |
| Independent execution attestations + freshness gate (I-20) | `crates/atlas-operator-agent/src/attestation.rs` |
| Pending-approval queue (multisig, no silent scope expansion — I-21) | `crates/atlas-operator-agent/src/pending.rs` |
| Four-persona agent dashboard mapping | `crates/atlas-operator-agent/src/agents.rs` |
| `client.get_agents` / `get_keepers` / `get_pending` | `crates/atlas-rs/src/client.rs` |
| `AtlasPlatform.getAgents` / `getKeepers` / `getPending` | `sdk/ts/src/platform.ts` |
| `keeper_mandate` / `revoked_mandate` / `execution_attestation` PDAs | `sdk/rust/src/lib.rs` |
| `/api/v1/agents` + `/treasury/{id}/keepers` + `/treasury/{id}/pending` | `crates/atlas-public-api/src/endpoints.rs` |
| 9 Phase 15 telemetry metrics | `crates/atlas-telemetry/src/lib.rs` |
| `/agents` playground | `sdk/playground/agents.html` |

## The four hard rules

| Rule | What it says | Where it's enforced |
|---|---|---|
| I-18 | Cross-class signing rejected. The rebalance keeper cannot land a settlement; the settlement keeper cannot post a Pyth update. | `assert_action_authorized` in `role.rs`; per-program ix entry checks the signer's `ActionBitset`. |
| I-19 | Mandates expire and ratchet. Every action consumes a slot in `actions_used` and `notional_used_q64`. Renewal is a Squads vote. | `KeeperMandate::admit` in `mandate.rs`; the program copies the same logic. |
| I-20 | Independent execution attestations. High-impact actions need both the SP1 receipt **and** an `ExecutionAttestation` from a *different* signer with a *different* RPC quorum. | `verify_execution_attestation` in `attestation.rs`. `MAX_ATTESTATION_STALENESS_SLOTS = 16`. |
| I-21 | No silent scope expansion. Adding an action class to a mandate requires a fresh mandate from a Squads vote. The program rejects mandates whose `allowed_action_bitset` is wider than the canonical role bitset. | `KeeperMandate::new` returns `ScopeWidenedPastCanonical`. |

## Topology — seven keepers, eight action classes

```text
                ┌─────────────────────────────────────────┐
   user-facing  │  Risk · Yield · Compliance · Execution  │
                └─────────────────────┬───────────────────┘
                                      │  /agents
                                      ▼
   +--------------------+  +--------------------+  +--------------------+  +--------------------+
   |  RebalanceKeeper   |  |  SettlementKeeper  |  |   AttestationKpr   |  |     AltKeeper      |
   |  rebalance_execute |  |  settlement_settle |  |  attestation_sign  |  |     alt_mutate     |
   +---------+----------+  +---------+----------+  +---------+----------+  +---------+----------+
             │                       │                       │                       │
             ▼                       ▼                       ▼                       ▼
        SP1 receipt           SP1 receipt              co-signs each           ALT lifecycle
        + attestation         + attestation             action above            (no funds, no
                                                        threshold               state mutation
                                                                                outside ALT)
                                                                                
   +--------------------+  +--------------------+  +--------------------+
   |    ArchiveKeeper   |  |     HedgeKeeper    |  |   PythPostKeeper   |
   |  archive_append +  |  | hedge_open_close   |  |     pyth_post      |
   |  disclosure_log    |  |       _resize      |  |                    |
   +--------------------+  +--------------------+  +--------------------+
```

Each keeper holds a distinct on-chain key. Compromising the rebalance
keeper's secret yields exactly one capability — submit a rebalance —
and even that requires a co-signed attestation from a key the attacker
does not control.

## Mandate lifecycle (I-19 + I-21)

```text
multisig-issue ──► KeeperMandate (valid_from, valid_until, max_actions, max_notional)
                          │
                          │ ratcheting via admit():
                          │   actions_used += 1
                          │   notional_used_q64 += notional_delta
                          ▼
                  cap exhausted ──► reject; agent enqueues "renewal" PendingBundle
                          │
                          │ squads.vote (Approve)
                          ▼
              KeeperRegistry::rotate (atomic) ──► RevokedMandate (audit log)
                                              ──► fresh KeeperMandate
```

## Independent execution attestation (I-20)

```text
   action_keeper            attestation_keeper
   (rebalance binary)       (separate process, separate key, separate RPC quorum)
        │                            │
        ├─ submit ix ────────────────┘
        │   payload_hash = blake3("atlas.attestation.v1.<kind>." || effect)
        │
        ▼
   on-chain verifier ix:
     1. attest_freshness(slot, now)         — reject if lag > 16 slots
     2. attestation_keeper != action_keeper — reject same signer
     3. kind.covering_role() == action role — reject mismatch
     4. attestation.payload_hash == effect  — reject divergent observed state
```

A single compromised process cannot land an action: the attestation
keeper would have to *also* be compromised, *and* its independent RPC
quorum would have to corroborate the false post-state — within 16
slots (~6.4s). That's the institutional-trust delta over a single-key
keeper.

## Multi-agent mapping (no hidden LLM)

| Persona | Backed by | Deterministic | Proof-gated | Attestation-gated |
|---|---|---|---|---|
| Risk Agent | `atlas-exposure` + rebalancer rejection path | ✓ | ✓ | — |
| Yield Agent | `atlas-pipeline` + `atlas-lie` + `atlas-verifier` | ✓ | ✓ | ✓ |
| Compliance Agent | `atlas-payments::compliance` | ✓ | — | — |
| Execution Agent | `atlas-operator-agent` + `atlas_keeper_registry` | ✓ | ✓ | ✓ |

Every "agent" is a deterministic crate. No LLM is in the commitment
path; the only model anywhere in Atlas is the registered ranker, and
its inputs/outputs are recorded in the SP1 receipt.

## Pending-approval flow (the multisig human-in-the-loop)

`/treasury/{id}/pending` shows everything the agent refused to
auto-execute: mandate renewals, scope expansions, actions above the
auto-execute notional threshold, compliance holds, manual reviews.
Priorities are `Critical / Normal / Low`; states are
`Pending → {Approved, Rejected, Stale}`; only `Approved` can advance
to `Executed`, and only after the keeper actually lands the tx. The
agent itself never auto-promotes — only a Squads vote can advance an
entry past `Pending`. Stale entries (window expired) flip to `Stale`
and have to be re-submitted.

## Acceptance bar

- 59 unit tests across the operator-agent crate cover: cross-role
  rejection, mandate ratcheting, expiry/before-valid-from boundaries,
  per-action vs total notional caps, scope-narrowing acceptance,
  scope-widening rejection, registry rotation, attestation freshness,
  same-signer rejection, kind/role mismatch, payload-hash mismatch,
  pending-queue priority ordering, expired-window flip, double-decide
  rejection.
- Telemetry: `atlas_keeper_cross_role_attempts_total`,
  `atlas_attestation_freshness_violations_total`,
  `atlas_attestation_same_signer_violations_total`,
  `atlas_mandate_scope_expansion_attempts_total` are hard alerts.
  Anything > 0 indicates a bug or an attack.
- Frontend: `/agents` renders the four-persona dashboard plus the
  ratcheted keeper table and the pending queue, with explicit
  `deterministic / proof-gated / attestation-gated` pills so a user
  can verify what each "agent" actually is.

## Why Zerion gets cited but Atlas is the upgrade

Zerion's `ZAI` lets you write natural-language policies for an agent
that holds spending power on your wallet. The trust assumption is
"Zerion's infra holds the keys responsibly". Atlas inverts it:

| | Zerion ZAI | Atlas Operator Agent |
|---|---|---|
| Policy storage | Zerion's backend | On-chain `KeeperMandate` |
| Policy enforcement | Zerion's process | The Solana program ix entry |
| Scope expansion | Zerion API | Squads multisig vote |
| Compromise of a keeper | Full agent capability | Exactly one action class, bounded by mandate caps |
| Action attestation | Zerion's signer | Separate signer + separate RPC quorum |
| Audit trail | Zerion's logs | `RevokedMandate` + `BlackBoxRecord` + Bubblegum anchor |

You don't have to trust Atlas. You read the program code.
