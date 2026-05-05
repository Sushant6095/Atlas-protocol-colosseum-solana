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
- Stage 05 EvaluateAgents (7-agent ensemble with veto authority)
- Stage 06 ResolveConsensus
- Stage 07 EnforceConstraints
- Stage 09 ExplainDecision (canonical JSON, hash-committed)
- Stage 11 ProveSp1 (sp1-recursion → Groth16 wrap)
- Stages 12–14 PlanExecution / SynthesizeTx / SimulateExecution
- Stage 15 SubmitBundle (Jito + SWQoS dual path)
- Stage 16 ArchiveTelemetry
- `atlas-replay` binary for historical reconstruction + counterfactual + adversarial fuzz
- `tests/adversarial` corpus (10 hostile scenarios from directive §12)
- `ops/grafana` dashboards from §13 SLOs
