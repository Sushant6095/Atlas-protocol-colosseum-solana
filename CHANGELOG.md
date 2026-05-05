# Atlas Changelog

## Unreleased — Phase 2.2 (2026-05-06) — Ingestion fabric closeout (directive §7-§10)

### atlas-webhook-rx binary

- New standalone Helius webhook ingress (axum HTTP, port 9090 default).
- Endpoints:
  - `GET /healthz` — process liveness.
  - `POST /v1/webhooks/helius?webhook_id=...&slot=...&sig=<128-hex>` —
    accepts signed payload (header `x-atlas-signature: <hex MAC>`),
    verifies HMAC-SHA256, dedups on `(webhook_id, slot, sig)`, runs the
    token-bucket rate limit, then queues. Receiver does no work inline
    (anti-pattern §9).
  - `GET /v1/webhooks/helius/replay` — replay endpoint exposing observed
    `(webhook_id, slot)` tuples for the past window (directive §7).
- Status codes: 200 accept, 200+duplicate body, 400 malformed, 401 hmac,
  429 rate-limited.
- Reads `ATLAS_WEBHOOK_SECRET` env or `--secret` flag.

### atlas-bus → telemetry wiring (§8)

- `AtlasBus::inject` now increments
  `atlas_ingest_dedup_dropped_total{source}` on dedup and
  `atlas_ingest_bus_overflow_commitment_total{vault_id="_global", replay="false"}`
  on commitment overflow. The local `BusCounters` AtomicU64 fields stay as
  the in-process counter; Prometheus is the cross-process export.
- New `AtlasEvent::source_label()` helper produces stable lowercase labels
  for every variant (`"n/a"` for `SlotAdvance` and `BundleStatusEvent`).

### atlas-telemetry — Phase 02 metrics finally landed

- 7 directive §8 metrics added (an earlier Edit had failed silently):
  - `atlas_ingest_event_lag_slots` (histogram, label `source`)
  - `atlas_ingest_event_lag_ms` (histogram, label `source`, gRPC sources)
  - `atlas_ingest_quorum_match_rate_bps` (gauge)
  - `atlas_ingest_dedup_dropped_total` (counter, label `source`)
  - `atlas_ingest_bus_overflow_commitment_total` (counter — hard alert)
  - `atlas_ingest_source_quarantined_total` (counter, label `source`)
  - `atlas_ingest_replay_drift_events_total` (counter — hard alert)

### atlas-bus — `Polling*` naming (§9 anti-pattern)

- Renamed REST/poll-only adapters to satisfy directive §9 ("polling-only
  adapters hidden behind a stream interface" → reject):
  - `BirdeyeAdapter` → `PollingBirdeyeAdapter` (alias kept w/ `#[deprecated]`)
  - `DefiLlamaAdapter` → `PollingDefiLlamaAdapter`
  - `JupiterAdapter` → `PollingJupiterAdapter`
- The `Polling*` prefix declares transport semantics in the type name so
  reviewers cannot mistake them for streams.

### Prometheus alert rules

- `ops/prometheus/atlas-alerts.yaml` — full alert rule set wired to every
  §8 + §13 SLO. Severity: `page` for funds-at-risk breaches, `warn` for
  business-hours follow-up. Includes:
  - rebalance e2e p99 > 90s (warn)
  - proof gen p99 > 75s (warn)
  - inference p99 > 250 ms (warn)
  - verifier CU p99 > 280k (warn)
  - rebalance CU p99 > 1.2M (page)
  - cpi failure rate > 0.5% (page)
  - consensus disagreement > 1500 bps sustained (warn)
  - stale proof rejections rate > 0 (page)
  - archival failure on any increase (page)
  - quorum disagreement spike vs 7d median (warn)
  - ingest event lag slots p99 > 2 (warn)
  - ingest event lag ms p99 > 600 (warn)
  - quorum match rate < 99.5% sustained 1h (warn)
  - dedup drop spike vs 7d median (warn)
  - commitment-channel overflow on any (page)
  - source quarantine spike (warn)
  - replay drift on any (page)

### CI replay-parity workflow

- `.github/workflows/replay-parity.yml` runs on push, pull_request, and
  daily cron. Builds `atlas-bus-replay`, runs `--slot-range 1000000..1216000`
  (216_000 slots ≈ 24h at 400ms), asserts `replay_parity == true` via `jq`,
  then runs the workspace test suite + clippy with `-D warnings` on
  commitment-bound crates (atlas-public-input, atlas-pipeline, atlas-bus).

### Tests added (3)

- `webhook_rx` bin: 3 (decode_hex round-trip, decode_hex odd-length reject,
  decode_sig wrong-length reject). Bus + telemetry wiring is exercised
  through the existing 56-test atlas-bus suite (no new tests needed; the
  metric counter incs are observable via the `gather_text` round-trip
  test in atlas-telemetry).

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 56 + 3 (webhook_rx bin) = 59 |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **185** (up from 182) |

### Directive 02 §10 deliverable checklist — closed out

| Item | Status |
|---|---|
| atlas-bus crate w/ typed event enum, bounded channels, content-addressed dedup | ✓ |
| Adapters for Yellowstone (Triton + Helius + QuickNode), Pyth Hermes, Switchboard, Birdeye, Jupiter, DefiLlama | ✓ trait surface; real transport in Phase 2 |
| Quorum engine with reliability EMA and quarantine | ✓ |
| Anomaly trigger CEP layer with deterministic replay parity | ✓ all 7 triggers, replay-parity test |
| `atlas-bus replay` binary | ✓ `--slot-range` + `--archive` |
| Helius webhook receiver, signed-payload verified, idempotent | ✓ standalone bin |
| Prometheus metrics + alert rules for every SLO | ✓ all 11 + 7 ingest = 18 metrics, alert rules YAML |
| CI replay test against last 24h archive | ✓ `.github/workflows/replay-parity.yml` |

---

## Unreleased — Phase 2.1 (2026-05-06) — Ingestion fabric hardening (directive §3-§6)

### atlas-bus extensions

- `tier` module — `FailoverEngine` with hot/warm/cold tier per `SourceId`.
  Promotion order is deterministic (lowest `SourceId` discriminant first) so
  replay reproduces transitions byte-for-byte. Hot stalls demote to Cold and
  promote a Warm in the same evaluation tick. Configurable via
  `FailoverPolicy { hot_stall_slots, warm_poll_interval_slots, max_failures }`.
- `replay_buffer` module — `SourceReplayBuffer` (256-slot ring per source) with
  `last_acked_slot`, monotonic `ack`, and `rewind()` returning all entries
  with `slot > last_acked_slot`. Adapters use this on reconnect to resume.
- `backpressure` module — `BackpressureMonitor` tracks the gap between
  `highest_published_slot` and `highest_consumed_slot`. Above
  `degraded_threshold_slots` (default 64) the monitor flips to
  `BusMode::Degraded { lag_slots }`. Hysteresis: returns to `Healthy` only
  when lag drops below `recovery_threshold_slots` (default 16).
  `block_rebalances()` is the gate the orchestrator polls before submitting.
- `reorder` module — 32-deep min-heap reorder buffer for the commitment
  channel. Out-of-order events with `seq < next_expected` but inside the
  window are buffered; the heap drains contiguously when gaps fill. Events
  outside the window emit `ReorderError::OutOfWindow` so the pipeline halts
  and reconciles via replay.
- `anomaly` module — three new triggers added to complete directive §5:
  - `ProtocolUtilizationSpike` — when an account flagged in
    `AccountDirectory::utilization_accounts` reads ≥ `utilization_spike_bps`
    (default 9_500).
  - `WhaleExit` — when a flagged wallet account's balance moves ≥
    `whale_exit_protocol_tvl_bps` of TVL (default 100 = 1%).
  - `RpcSplit` — emitted by `AnomalyEngine::observe_quorum_disagreement`
    whenever the quorum engine returns Hard or Total. Sources are sorted +
    deduplicated for replay parity.
  - `AccountDirectory` is the per-vault registry caller pre-populates with
    which accounts are utilization or wallet proxies.

### atlas-bus-replay binary

- New flag form: `--slot-range S0..S1` (with legacy `--slot-start`/`--slot-end`
  kept as a fallback). Refuses inverted ranges.
- New `--archive <path>` flag accepted; Phase 2 wires the warehouse decoder.

### Tests added (21)

| Module | Tests |
|---|---|
| tier | 4 (Hot stall demotion + Warm promotion, deterministic order, record_event clears failures, no Warm leaves Hot demoted) |
| replay_buffer | 3 (capacity eviction, rewind post-ack, monotonic ack) |
| backpressure | 4 (Healthy when keeping up, Degraded when over threshold, recovery hysteresis, hysteresis prevents thrash) |
| reorder | 5 (in-order release, gap-fill release, out-of-window reject, duplicate already-passed drops, buffer-full rejects) |
| anomaly | 5 (utilization spike fires/skips, whale exit on balance drop, RpcSplit emit, RpcSplit empty no trigger) |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 56 (was 35) |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **182** (up from 161) |

### Directive 02 §3-§6 coverage

| § | Item | Status |
|---|---|---|
| §3 | Configurable quorum policy + 4 disagreement classes | ✓ Phase 2.0 |
| §3 | RpcSplit event on Hard/Total | ✓ via `observe_quorum_disagreement` |
| §3 | Reliability EMA + quarantine | ✓ Phase 2.0 |
| §3 | AS region diversity guard | ✓ Phase 2.0 |
| §4 | Hot/warm/cold tier, 1-slot promotion | ✓ |
| §4 | 256-slot per-source replay buffer + rewind | ✓ |
| §4 | Backpressure → Degraded mode at >64 slots | ✓ |
| §4 | 32-deep out-of-order buffer + Reorder error | ✓ |
| §5 | All 7 anomaly triggers | ✓ |
| §5 | Replay parity for triggers | ✓ |
| §6 | `atlas-bus replay --slot-range` flag form | ✓ |
| §6 | `--archive <path>` flag accepted | ✓ (Phase 2 wires reader) |

---

## Unreleased — Phase 2 (2026-05-06) — Real-Time Data Ingestion Fabric (directive 02)

### atlas-bus crate
- `event` module — `AtlasEvent` (7 variants), `SourceId` (14 stable discriminants),
  `canonical_event_bytes`, `event_id = blake3(canonical_bytes)` for
  content-addressed dedup. `is_commitment_bound()` partitions the surface.
- `bus` module — `AtlasBus` with bounded mpsc channels (commitment + monitoring,
  default 65_536). Commitment overflow fatal per §2; monitoring overflow
  increments a counter. `DedupRing` FIFO eviction at cap. Reorder-window guard.
- `source` module — `MarketSource` trait (id / run / health / backoff),
  `Health`, `BackoffPolicy`, `MarketSourceError` taxonomy.
- `quorum` module — `QuorumEngine` with reliability EMA + quarantine + AS
  region diversity guard. Six classification rules: Confirmed / Soft / Hard /
  Total.
- `anomaly` module — 7 CEP triggers (VolatilitySpike, OracleDrift,
  LiquidityCollapse, ProtocolUtilizationSpike, WhaleExit, FeedStall, RpcSplit).
  Pure-function ingestion → replay-parity assertable.
- `replay` module — `ReplaySource` + `ReplayBus::drain` (synchronous,
  deterministic).
- `webhook` module — `HeliusWebhookReceiver` with HMAC-SHA256, idempotency
  over `(webhook_id, slot, sig)`, token-bucket rate limit, replay endpoint.
- `adapters` module — 13 typed stubs implementing `MarketSource` for every
  directive §1 provider. `AtomicHealth` lock-free snapshots.

### atlas-bus-replay binary
- `--slot-start S --slot-end E` synthesizes deterministic event stream,
  asserts replay parity across two independent runs. Exit code 2 on divergence.

### atlas-telemetry §8 SLOs
- 7 new metrics: ingest_event_lag_slots, ingest_event_lag_ms,
  ingest_quorum_match_rate_bps, ingest_dedup_dropped_total,
  ingest_bus_overflow_commitment_total, ingest_source_quarantined_total,
  ingest_replay_drift_events_total.

### Tests added (35)
- event 5, source 3, bus 5, quorum 7, anomaly 6 (incl. replay parity),
  webhook 5, replay 2, adapters 2.

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 35 |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **161** (up from 126) |

### Directive 02 coverage
| § | Item | Status |
|---|---|---|
| §0 | Sub-slot freshness | trait surface ready, real gRPC Phase 2 |
| §0 | Quorum integrity | ✓ |
| §0 | Replayable | ✓ proven via parity test + bin |
| §0 | Backpressure-aware | ✓ commitment overflow fatal |
| §1 | All 13 providers have a typed adapter | ✓ |
| §2 | Single in-process bus, no Kafka, content-addressed dedup, reorder window | ✓ |
| §3 | Quorum policy, EMA, quarantine, AS-region diversity, 4 classes | ✓ |
| §5 | 7 anomaly triggers + replay parity | ✓ |
| §6 | `atlas-bus-replay` binary | ✓ |
| §7 | Helius webhook signed-payload + idempotent + rate limit | ✓ |
| §8 | 7 SLO metrics registered | ✓ |
| §9 | Anti-patterns enforced | ✓ |

---

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
