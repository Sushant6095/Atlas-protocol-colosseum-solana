# Atlas Private Execution Layer — MagicBlock Private Ephemeral Rollups

> Phase 14 hides amounts. Phase 18 hides execution path. Together
> they form the institutional-privacy bundle: **amounts confidential,
> routing private, settlement publicly verifiable.**

## What Phase 18 ships

| Surface | Code |
|---|---|
| `ExecutionPrivacy` declaration + I-25 enforcement | [crates/atlas-per/src/execution_privacy.rs](crates/atlas-per/src/execution_privacy.rs) |
| `ErSession` PDA shape + lifecycle | [crates/atlas-per/src/session.rs](crates/atlas-per/src/session.rs) |
| `verify_settlement` — verifier mirror of the on-chain check | [crates/atlas-per/src/settlement.rs](crates/atlas-per/src/settlement.rs) |
| `PerGateway` off-chain mirror + Bubblegum events | [crates/atlas-per/src/gateway.rs](crates/atlas-per/src/gateway.rs) |
| Public input v4 (396 bytes) | [crates/atlas-per/src/public_input_v4.rs](crates/atlas-per/src/public_input_v4.rs) |
| Disclosure scopes: `ExecutionPathPostHoc` / `ExecutionPathRealtime` / `AgentTraceOnly` | [crates/atlas-confidential/src/disclosure.rs](crates/atlas-confidential/src/disclosure.rs) |
| CPI allowlist: `AtlasPerGateway` + `MagicBlockEr` | [crates/atlas-cpi-guard/src/allowlist.rs](crates/atlas-cpi-guard/src/allowlist.rs) |
| Failure classes 8001–8004 (PerSessionExpired / SettlementVerifierReject / OperatorCensorship / SettlementReplay) | [crates/atlas-failure/src/class.rs](crates/atlas-failure/src/class.rs) |
| Chaos game day `PerOperatorAdversarial` (5 cases) | [crates/atlas-chaos/src/scenario.rs](crates/atlas-chaos/src/scenario.rs) |
| 7 Phase 18 telemetry metrics | [crates/atlas-telemetry/src/lib.rs](crates/atlas-telemetry/src/lib.rs) |
| 4 REST endpoints + atlas-rs + @atlas/sdk client methods | [crates/atlas-public-api/src/endpoints.rs](crates/atlas-public-api/src/endpoints.rs) + [client.rs](crates/atlas-rs/src/client.rs) + [platform.ts](sdk/ts/src/platform.ts) |
| `/per` playground with side-by-side mainnet-vs-private demo + auditor disclosure demo | [sdk/playground/per.html](sdk/playground/per.html) |

## Hard rules (extend Phase 01)

| Rule | What it says | Enforced where |
|---|---|---|
| I-22 | Private execution preserves on-chain settlement. Beyond `MAX_PER_SESSION_SLOTS` (256) the gateway auto-undelegates. | `PerGateway::sweep_stalled` + `verify_settlement` deadline check |
| I-23 | Verifier accepts only ER-rooted state transitions. Proof commits to `(pre, post, er_session_id, er_state_root)`. | `PublicInputV4` 396-byte layout; `verify_settlement::PostStateMismatch` |
| I-24 | Private mode is per-vault and lifelong. Choice is part of the strategy commitment hash. | `ExecutionPrivacy::commitment_hash()` folds into vault commitment |
| I-25 | No private execution without a disclosure policy covering execution paths. | `require_execution_path_scope()` rejects PrivateER without `ExecutionPath*` scope |

## Topology

```text
mainnet                            private ephemeral rollup
─────────                          ──────────────────────────

vault state account            ──▶ delegate (MagicBlock primitive)
                                        │
                                        ▼
                              ER session opens
                              session_id = blake3("atlas.per.session.v1" || vault_id || nonce)
                                        │
                                        ▼
                              Stages 11→15 inside ER
                              (intermediate state never on mainnet)
                                        │
                                        ▼
                              session computes post_state_commitment
                                        │
                                        ▼
                              ER produces:
                                - er_state_root (Merkle path)
                                - settlement_payload
                                        │
                                        ▼
                              Atlas verifier ix on mainnet:
                                - reads payload
                                - validates ER session integrity
                                - undelegates account
                                - applies post_state to vault
                                        │
                                        ▼
                              Bubblegum receipt anchored (Phase 03)
```

## Public input v4 (396 bytes)

| offset | size | name |
|---|---|---|
| 0 | 1 | version (`0x04`) |
| 1 | 1 | reserved |
| 2 | 2 | flags (bit2=confidential, bit3=private_execution) |
| 4 | 8 | slot |
| 12 | 32 | vault_id |
| 44 | 32 | model_hash |
| 76 | 32 | state_commitment_root |
| 108 | 32 | feature_root |
| 140 | 32 | consensus_root |
| 172 | 32 | allocation_ratios_root |
| 204 | 32 | explanation_hash |
| 236 | 32 | risk_state_hash |
| 268 | 32 | disclosure_policy_hash |
| **300** | **32** | **er_session_id** *(new in v4)* |
| **332** | **32** | **er_state_root** *(new in v4)* |
| **364** | **32** | **post_state_commitment** *(new in v4)* |

The `disclosure_policy_hash` stays at offset 268 (same as v3) so the
verifier's existing extraction code is unchanged. Only the suffix
grows.

## Settlement verification (verifier responsibility)

`verify_settlement(session, payload, public_input_post_state)` runs:

1. `session.status == Open` → otherwise reject as `Replay`.
2. `payload.session_id == session.session_id`.
3. `payload.vault_id == session.vault_id` → cross-vault reuse rejected.
4. `payload.submitter_program == session.magicblock_program` →
   otherwise mark Disputed and reject (operator-impersonation).
5. `payload.submitted_at_slot ≤ session.deadline_slot()` → otherwise
   mark Expired and reject.
6. `payload.post_state_commitment == public_input_post_state` →
   otherwise reject without state change.

Any failure leaves the vault account untouched. The auto-undelegation
safety net is the trust boundary; Atlas never holds funds the rollup
can permanently lock.

## Disclosure scope ladder

| Scope (existing, Phase 14) | Reveals |
|---|---|
| `AggregateOnly` | aggregate metrics |
| `PerProtocol` | per-protocol allocation |
| `PerTransaction` | individual transactions (amount-disclosure) |
| `RecipientList` | payment recipients |
| `Full` | everything (FinanceAdmin only) |

| Scope (new, Phase 18) | Reveals |
|---|---|
| `AgentTraceOnly` | agent-to-agent consensus trace; no external swap legs |
| `ExecutionPathPostHoc` | full session log after a configurable delay (e.g., 30 days) |
| `ExecutionPathRealtime` | session log streamed live to a regulator |

The scope ladder enforces that an `ExecutionPathPostHoc` grant cannot
be expanded to `ExecutionPathRealtime` by the issuer; the policy must
match exactly. Amount scopes and execution scopes do not subsume
each other.

## Failure classes (8xxx)

| Tag | Class | Remediation |
|---|---|---|
| 8001 | `PerSessionExpired` | RevertAndRetryOnce — auto-undelegate; rebalance retries on mainnet next cycle |
| 8002 | `SettlementVerifierReject` | RejectInvalid — proof or session-id mismatch |
| 8003 | `PerOperatorCensorship` | RejectAndSecurityEvent — submitter program is not the registered MagicBlock program |
| 8004 | `PerSettlementReplay` | RejectAndSecurityEvent — replayed payload caught by gateway dedupe |

## Telemetry SLOs

| Metric | SLO |
|---|---|
| `atlas_per_session_settle_seconds` (p99) | ≤ 30 s |
| `atlas_per_session_expired_total` | hard alert on rate spike |
| `atlas_per_settlement_verifier_reject_total` | hard alert on any |
| `atlas_per_replay_attempts_total` | hard alert on any |
| `atlas_per_operator_censorship_total` | hard alert on any |
| `atlas_per_undelegation_safety_drills_passed_24h` | = 1 (daily synthetic drill) |
| `atlas_disclosure_execution_path_unblinding_events_total` | dashboarded; alert on rate spike |

## Acceptance bar

- 43 unit tests in [crates/atlas-per](crates/atlas-per/) cover: I-25
  enforcement (PrivateER without ExecutionPath* rejected), I-24
  commitment-hash distinctness, session-slots-above-cap rejection,
  null MagicBlock program rejection, public input v4 layout pinned
  at every offset, dual-flag (confidential + private_execution)
  coexistence, settlement happy path, replay rejection, cross-vault
  rejection, session-id mismatch, unauthorised-submitter dispute
  flip, deadline-passed expiry flip, post-state mismatch without
  state change, gateway duplicate-open rejection, sweep-stalled
  expiry, gateway event emission for each lifecycle transition.
- 5 chaos cases in `GameDayScenario::PerOperatorAdversarial`:
  operator stall past window, settlement payload replay, cross-vault
  settlement attempt, forged er_state_root, non-allowlist CPI inside
  the ER. Every case must reject; vault state unchanged.
- 4 REST endpoints, atlas-rs + @atlas/sdk client methods, 7
  telemetry metrics, `/per` playground with mainnet-vs-private
  side-by-side demo and auditor disclosure demo.

## Why this is the institutional-privacy story

Phase 14 alone leaves the routing path visible — an observer who
reads mainnet still sees how Atlas got from old allocation to new
allocation, even if they cannot read the absolute notionals. Phase 18
alone leaves the notionals visible. **Both ship** for the full
institutional bundle:

| Threat | Mitigated by |
|---|---|
| Competitor reads our absolute treasury size | Phase 14 |
| Competitor reads our payroll | Phase 14 |
| Competitor copies our strategy by watching mainnet rebalances | Phase 18 |
| MEV searcher front-runs the path between proof generation and settlement | Phase 18 |
| Auditor needs to verify the *what* without seeing the *how* | Phase 18 |
| Whale mirrors our allocation by scraping on-chain ratios | Phase 14 (ratios) + Phase 18 (intermediate moves) |

Mainnet sees what happened. Mainnet does not see how. Selective
disclosure restores the how for those who need it.
