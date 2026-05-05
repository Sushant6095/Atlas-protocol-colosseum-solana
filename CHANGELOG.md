# Atlas Changelog

## Unreleased — Phase 1 (2026-05-05)

### Added

- `crates/atlas-public-input` — single source of truth for the 268-byte v2 public-input layout (I-4, I-9). Used by `atlas_verifier`, the SP1 guest, and the off-chain pipeline. Decode rejects v1, unknown flags, and non-canonical reserved bytes.
- `crates/atlas-pipeline` — 16-stage pipeline framework with `Stage` trait, `PipelineCtx`, replay flag, OpenTelemetry-ready spans, and `ArchivalStore` trait (I-8).
- Stage 01 `IngestState` — quorum-read across `N>=3` RPC providers; `⌈N/2⌉+1` hash agreement per account; slot divergence guard; content-addressed `snapshot_id`. Pure `compute_quorum` testable without network.
- Stage 03 `ExtractFeatures` — typed `FeatureVector` with per-element `FeatureLineage`; quantization to fixed-point i64 (scale 1e6, round-half-to-even) before hashing (I-5); deterministic feature root.
- Stage 08 `GenerateAllocation` — `AllocationVectorBps` enforcing `[u32; N]` summing to exactly 10_000 bps (I-5); `allocation_root` via domain-tagged hash.
- Stage 10 `SerializeCanonical` — builds the 268-byte v2 public input from upstream commitments; round-trips through `atlas-public-input::decode`.
- `tests/invariants` — integration test crate asserting I-4, I-5, I-6 today; expanding to I-1..I-12 in subsequent phases.
- `clippy.toml` — bans `HashMap`, `HashSet`, `chrono::Utc::now`, `SystemTime::now`, `unwrap`, `expect`, `panic!`, `todo!`, `unimplemented!` from production code paths (I-6, I-7, I-12).

### Architecture invariants tracked

| Invariant | Status |
|---|---|
| I-1 Strategy immutability | enforced in `atlas-vault` (no mutation ix beyond pause/tvl_cap) |
| I-2 Proof-gated state movement | enforced in `atlas-rebalancer` (only ix that moves principal) |
| I-3 Three-gate rebalance | enforced in `atlas-rebalancer::execute_rebalance` |
| I-4 Canonical public input | **live in this commit** via `atlas-public-input` |
| I-5 No floats in proof inputs | **live in this commit** via `AllocationVectorBps` |
| I-6 Deterministic ordering | **live in this commit** via `clippy.toml` + `BTreeMap` enforcement |
| I-7 No silent fallbacks | **live in this commit** via `Stage::run` returning `Result` |
| I-8 Replay archival | trait wired (`ArchivalStore`); concrete impl in Phase 3 |
| I-9 Single source of public-input truth | **live in this commit** |
| I-10 Cross-program invariant assertions | scaffolded in `atlas-rebalancer`; wires in Phase 2 with each CPI |
| I-11 Token-2022 awareness | declared in `atlas-vault` strategy commitment |
| I-12 No `unwrap` on production paths | **live in this commit** via `clippy.toml` |

### Pending — next phases

- Stage 02 NormalizeMarket
- Stage 04 PreprocessRisk (contagion graph + correlated-liquidation model)
- Stage 07 EnforceConstraints
- Stage 09 ExplainDecision (canonical JSON, hash-committed)
- Stage 11 ProveSp1 (sp1-recursion → Groth16 wrap)
- Stages 12–14 PlanExecution / SynthesizeTx / SimulateExecution
- Stage 15 SubmitBundle (Jito + SWQoS dual path)
- Stage 16 ArchiveTelemetry
- `atlas-replay` binary for historical reconstruction + counterfactual + adversarial fuzz
- `tests/adversarial` corpus (10 hostile scenarios from directive §12)
- `ops/grafana` dashboards from §13 SLOs

---

## Unreleased — Phase 1.1 (2026-05-06)

### Added

- **Stage 03 ExtractFeatures — extended.** Full directive §4 feature catalog now lands typed:
  `ProtocolUtilization`, `LiquidityDepth1Pct`, `LiquidityDepth5Pct`, `Volatility30m`,
  `Volatility24h`, `ApyInstability`, `OracleDeviation`, `DrawdownVelocity`,
  `LiquidityStress`, `RegimeLabel`, `CorrelationCell`. Features carry explicit
  `(protocol_index, secondary_index)` so correlation-matrix cells round-trip via the
  same merkle leaf format. Helpers added: `parkinson_volatility`, `stddev` (Bessel),
  `correlation` (Pearson), `lower_triangular_cells`. Quantization is fixed-point i64
  scale 1e6, `round_ties_even` (banker's rounding) — matches the SP1 guest path.
- **Stage 05 EvaluateAgents.** `AgentId` enum (7 agents, stable u8 discriminants),
  `VetoLevel` (Soft / Hard), `RejectionCode` (11 stable u16 codes),
  `AgentProposal::validate` enforcing length, sum-to-10_000, confidence cap, and
  veto-authority check (`YieldMax` may not hard-veto; `ExecEfficiency` may not
  hard-veto; etc.). `proposal_commit` is a domain-tagged hash over the canonical
  fields; `ensemble_root` is `merkle_with_tag(b"atlas.ensemble.v2", per_agent_model_hashes)`
  and lands in `public_input.model_hash`.
- **Stage 06 ResolveConsensus.** Hard-veto short-circuit: any authorized agent
  raising `VetoLevel::Hard` collapses the rebalance to the pre-committed defensive
  vector, byte-equal, regardless of any other proposal. Soft veto contributes
  `weight × −1` to the weighted vote. Weighted aggregation = `confidence ×
  historical_accuracy_ema` per agent. Disagreement metric =
  `1 − cosine(median, mean)` in bps, computed entirely in integer fixed-point
  via Newton's-method `isqrt_u128` — no float drift between off-chain pipeline
  and SP1 guest. Magnitude clipping toward `current_allocation` activates when
  disagreement exceeds `τ_disagree`. Renormalization to exactly 10_000 bps via
  largest-remainder. Consensus root =
  `hash_with_tag(b"atlas.consensus.v2", sorted_proposal_commits)`.

### Tests

- Unit tests across new stages: `parkinson_zero_for_empty`, `parkinson_zero_for_flat`,
  `parkinson_increases_with_range`, `correlation_within_bounds`, `lower_triangular_count_correct`,
  `stddev_sample_correction`, `correlation_matrix_in_feature_root`, agent
  validate / commit / ensemble-root tests, consensus
  `hard_veto_collapses_to_defensive_byte_equal`, `unanimous_proposals_yield_those_proposals`,
  `final_allocation_always_sums_to_10000`, `cosine_orthogonal_is_zero`,
  `cosine_identical_is_10000`, `isqrt_known_values`, `high_disagreement_clips_toward_current`,
  `consensus_root_order_invariant`, `unauthorized_hard_veto_is_rejected_at_validation`.
- **Property test (directive §5 acceptance gate).** `hard_veto_collapses_to_defensive`
  in `tests/invariants` runs 256 randomized cases over `n ∈ [2,8]` protocols with
  6 random clean proposals + 1 hard veto from a hard-veto-authorized agent. Asserts
  the final allocation is byte-equal to the defensive vector in every case.

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 33 |
| atlas-invariants-tests | 6 (incl. 256-case proptest) |
| **Total** | **44** |

---

## Unreleased — Phase 1.2 (2026-05-06)

### Added

- **canonical_json module** — directive-compliant JSON serializer for hash-committed
  payloads. Banned use of `serde_json::to_string` on commitment paths
  (anti-pattern §14). Keys sorted lexicographically by UTF-8 codepoint, no
  whitespace, integer-only numerics, ASCII-only strings, RFC 8259 escapes for
  control chars.
- **Stage 09 ExplainDecision** — `StructuredExplanation` with stable enums
  (`Regime`, `Signal`, `Constraint`), `canonical_bytes()` reproducing the
  directive §7 example byte-for-byte, `explanation_hash()` =
  `hash_with_tag(b"atlas.expl.v2", canonical_bytes)`. Constraints dedup +
  sort lexicographically inside the canonical form. Drivers preserve insertion
  order — caller responsibility for stability.
- **Stage 04 PreprocessRisk** — full live topology:
  - `ContagionGraph` with `(from, to, kind)` deterministic ordering and
    domain-tagged Merkle root.
  - `OracleDependencyMap` keyed by `OracleId` → sorted/dedup `Vec<ProtocolId>`.
  - `correlated_liquidation_loss` integer-only simulator running shock
    scenarios over `ProtocolExposure { notional_bps, leverage_bps }`.
  - `LiquidityForecast` per scenario (Calm/Stressed/Crisis) with coverage
    helper that handles zero-queue.
  - `RiskTopology::build` outputs the `risk_state_hash` committed to
    `public_input.risk_state_hash`.
  - **Emergency triggers** — pure `evaluate_emergency_triggers` returns the
    first hit in deterministic order across all five rules: volatility spike,
    oracle deviation, projected proof age, TVL crash, consensus disagreement.
- **Stage 12 PlanExecution + 9.1 ALT engine + 9.2 CU intelligence**:
  - `CpiPlan { legs, predicted_cu, plan_root }`. `predict_cu` = Σ p99 + 15%.
  - `CuHistogram` ring buffer (cap 1000), `p99()` from sorted copy.
  - `AltDescriptor` content-addressed by account set; `compact_alts` collapses
    pairs with ≥80% intersection.
- **Stage 13 SynthesizeTx** — `segment_plan` splits over-budget plans into the
  minimal number of transactions; never silently drops legs (asserted via
  `segment_over_budget_splits_no_drops`).
- **Stage 14 SimulateExecution** — `evaluate_simulation` rejects on non-zero
  `err`, recognized failure-string log matches (insufficient funds / slippage
  / stale oracle, both lower-cased and CamelCase), CU usage exceeding budget,
  and CU drift > 25% above prediction.
- **Prover network** (directive §10) — `ProverRegistry`,
  `ProverRecord`, weighted dispatch with deterministic randomness beacon
  (sha256(slot ‖ vault ‖ beacon)), full slashing logic
  (`InvalidProof` → 100% burn, `MissedDeadline` → linear, `DuplicateSubmission`
  → reputation-only), reputation EMA over correctness + latency.

### Tests added

- `canonical_json`: 6 tests (empty object, key order, array order, no
  whitespace, non-ASCII rejection, deterministic encoding).
- `explanation`: 4 tests (directive byte-for-byte match, deterministic hash,
  driver-order sensitivity, constraint dedup).
- `risk`: 11 tests (linear scaling, zero-empty, contagion order invariance,
  oracle map protocols, hash sensitivity, liquidity coverage, all five
  emergency trigger rules + no-trigger normal case).
- `planning`: 9 tests (15% buffer, p99, ring eviction, ALT content-address,
  ALT compaction, plan root determinism, segmentation no-drop).
- `simulate`: 8 tests (accept clean, reject error, slippage / insufficient
  funds / stale oracle log matches, CU drift above + accept under threshold,
  budget overrun).
- `prover_network`: 9 tests (upsert/active filter, all three slash reasons,
  dispatch picks active, dispatch determinism, none when empty, reputation
  ema rises on success / falls on failure, weighted dispatch favors high
  reputation in ≥5:1 ratio over 1000 trials).

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 (was 33) |
| atlas-invariants-tests | 6 |
| **Total** | **93** (up from 44) |

---

## Unreleased — Phase 1.3 (2026-05-06)

### Added

- **crates/atlas-telemetry** — Prometheus metrics + tracing-span helpers. Implements
  the §13 SLO surface as a non-negotiable observability contract:
  histograms (`atlas_rebalance_e2e_seconds`, `atlas_proof_gen_seconds`,
  `atlas_inference_ms`, `atlas_ingest_quorum_ms`, `atlas_verifier_cu`,
  `atlas_rebalance_cu_total`), counters (`atlas_cpi_failure_total`,
  `atlas_stale_proof_rejections_total`, `atlas_archival_failures_total`,
  `atlas_quorum_disagreement_total`), gauge
  (`atlas_consensus_disagreement_bps`). Mandatory labels `vault_id` + `replay`
  on every metric; `protocol` added on `cpi_failure_total`.
  Spans created via `span()` carry `stage`, `vault_id`, `slot`, `replay`,
  `duration_ms` per directive. `gather_text()` produces Prometheus text
  exposition for any HTTP exposition endpoint.
- **crates/atlas-replay** binary (§11). Three subcommands:
  - `atlas-replay run --vault <hex> --slot <u64>` — reconstructs a historical
    rebalance from the archival store and asserts byte-identity vs. the
    archived public input + proof. Returns structured JSON outcome.
  - `atlas-replay what-if --vault --slot --override agent.<Name>.weight=<bps>`
    — counterfactual replay. Override parser rejects unknown agents,
    unknown fields, out-of-range weights, unsupported namespaces.
  - `atlas-replay fuzz --scenario <kind> --slots N --magnitude <bps>` — runs
    one of the 7 directive §11 adversarial scenarios:
    `OracleDrift{Linear,Sudden,Oscillating}`, `LiquidityVanish`,
    `VolatilityShock`, `ProtocolInsolvency`, `RpcQuorumSplit`,
    `StaleProofReplay`, `ForgedVaultTarget`, `CuExhaustion`. Each scenario
    is a pure function returning `ScenarioOutcome::{DefensiveTriggered |
    Halted | RejectedAtVerifier | SegmentedPlan | NoOp | RebalancedSafely}`
    where the first five are "safe" outcomes; the last is rejected for
    corruption-bearing scenarios. Exit code 0 for safe, 1 for unsafe — CI
    can fail on regressions.
- **tests/adversarial** — directive §12 corpus, all ten cases. Each test
  exercises the verifier-side gate, ingest quorum, segmentation, consensus
  arbitration, simulation gate, or archival contract:
  1. `replay_old_proof_rejected` — proof beyond `MAX_STALE_SLOTS` window
  2. `wrong_vault_id_rejected` — vault A proof submitted to vault B
  3. `wrong_model_hash_rejected` — proof model_hash ≠ vault.approved
  4. `forged_state_root_rejected` — public input state_root ≠ snapshot
  5. `proof_substitution_rejected` — proof from unrelated public input
  6. `quorum_split_halts` — 1-1-1 RPC split → ingest halts
  7. `cpi_failure_atomic` — failing simulation log → reject before submit
  8. `cu_exhaustion_segments` — 6×600k legs → segmented, no leg dropped
  9. `defensive_mode_on_hard_veto` — TailRisk Hard veto → final == defensive
  10. `archival_failure_aborts` — archive write Err → bundle never submits
- **ops/grafana/atlas-overview.json** — committed dashboard wired to all §13
  metrics with directive thresholds (rebalance e2e p99 90s, verifier CU 280k,
  consensus disagreement alert > 1500 bps, rejection counters per-rate).

### Tests

- `atlas-telemetry`: 3 (registry contract, vault_id_hex format, span value).
- `atlas-replay` lib: 18 (10 scenario tests covering all 7 directive §11
  scenarios + 8 whatif/replay parser tests).
- `atlas-replay` bin: 2 (pubkey parser).
- `tests/adversarial`: 10 (one per directive §12 case).

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 (18 lib + 2 bin) |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **126** (up from 93) |

### Directive coverage

| § | Item | Status |
|---|---|---|
| §11 | atlas-replay binary | ✓ run / what-if / fuzz |
| §11 | 7 fuzz scenarios | ✓ all 7 implemented + tested |
| §11 | "Pass only if rebalance halts or stays safe" contract | ✓ via `ScenarioOutcome::is_safe` |
| §12 | All 10 adversarial cases | ✓ |
| §13 | All 11 directive metrics registered | ✓ |
| §13 | Mandatory labels (vault_id, slot, replay) | ✓ |
| §13 | `replay=true` tag for replay-mode spans | ✓ |
| §13 | Grafana dashboard committed | ✓ `ops/grafana/atlas-overview.json` |
| §14 | `serde_json::to_string` ban for commitment paths | ✓ via `canonical_json` module |
| §14 | `chrono::Utc::now` ban | ✓ via `clippy.toml` |
| §14 | `HashMap` for hash-touching collections ban | ✓ via `clippy.toml` |
| §14 | `unsafe` block ban | ✓ via `#![deny(unsafe_code)]` on every crate |
| §14 | `unwrap`/`expect`/`panic!` on prod paths | ✓ via clippy + crate-level deny |

### Directive coverage

| § | Item | Status |
|---|---|---|
| §7 | Canonical JSON, lex-sorted keys, no whitespace, integer-only, hash-committed | ✓ |
| §7 | `explanation_hash` byte-equal to directive example | ✓ proven via test |
| §8 | Contagion graph (collateral / oracle / liquidator edges) | ✓ |
| §8 | Oracle dependency map | ✓ |
| §8 | Correlated-liquidation model | ✓ integer-only |
| §8 | Liquidity-collapse forecast (Calm/Stressed/Crisis) | ✓ |
| §8 | All 5 emergency triggers | ✓ pure fn, tested |
| §9.1 | Per-protocol ALT, content-addressed | ✓ |
| §9.1 | ALT compaction at ≥80% intersection | ✓ |
| §9.2 | p99 CU histogram, ring of last 1000 | ✓ |
| §9.2 | CU prediction = Σ p99 + 15% | ✓ |
| §9.2 | Segment when > 1.4M, no leg dropped | ✓ proven via test |
| §9.4 | Simulation gate — error / log / CU drift | ✓ |
| §10 | Prover registry, dispatch, slashing | ✓ |
| §10 | Reputation EMA over correctness + latency | ✓ |
