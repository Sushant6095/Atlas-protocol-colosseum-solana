# Atlas Changelog

## Unreleased — Phase 7.1 (2026-05-06) — Directive 07 §5 + §8 + §12 closeout

Three crates close the remaining §12 deliverables that don't require
live changes to `programs/`. The on-chain Pinocchio + zero-copy
migration plan now ships as a tracked playbook at
`programs/MIGRATION.md`.

### `atlas-receipt-tree` — per-vault receipt tree (§5)

- `receipt_leaf(rebalance_id, slot, public_input_hash, status) =
  blake3("atlas.receipt.v1" || ...)` — domain-tagged leaf canonical
  bytes matching the on-chain shape.
- `select_depth(projected_lifetime)` enforces the directive's
  `2^depth ≥ projected × 4` rule. 2200-record vault → depth 14;
  smaller vaults floor at `MIN_DEPTH = 3`; ceiling at `MAX_DEPTH = 30`
  (concurrent merkle tree max).
- `ConcurrentMerkleTree { depth, leaves, authority }` with `append`,
  `root` (rebuilt bottom-up; pads with zero leaf to capacity), and
  `proof(leaf_index)` returning a `MerkleProof { leaf, leaf_index,
  path }`.
- `proof::verify_proof(proof, expected_root)` reconstructs the root
  from the path; tampered leaves or path nodes cause a
  `ProofError::RootMismatch`. `expected_root` comes from the vault
  state field that the rebalancer updates atomically with the
  receipt append (§5.3).

### `atlas-pyth-post` — pull-oracle posting as bundle first ix (§8)

- `freshness::verify_freshness(posted_slot, bundle_target_slot,
  conf_bps)` — same predicate as the on-chain verifier. Boundary at
  `MAX_LAG_SLOTS = 4` and `MAX_CONF_BPS = 80`. Tests pin the boundary
  passes and the +1-slot/+1-bp cases reject.
- `schedule::PostRefreshSchedule { bundle_target_slot, posts }` — the
  per-rebalance plan. `validate()` enforces freshness on every entry;
  one stale post fails the whole schedule (atomic-bundle expectation).
- `bundle::enforce_first_ix(ixs)` refuses any bundle whose first
  non-`ComputeBudget` instruction isn't the Pyth post — a missing
  Pyth post or any leading `AtlasIx` / `Other` rejects with
  `BundleLayoutError::PythPostNotFirst` / `PythPostMissing`.

### `atlas-mollusk-bench` — CU baseline + 5%-regression CI gate (§12)

- `Baseline { program, ix, baseline_cu, note }` — committed at
  `programs/bench/baseline.json`; updates require a deliberate diff
  in the same PR that lands the optimization.
- `BaselineDb` — flat-array storage so on-disk JSON diffs read
  naturally in PR review. `insert` rejects duplicates; `get(program,
  ix)` is a linear scan over the small fixed list.
- `report::check_regressions(db, observations)` — flags any
  `(program, ix)` whose `regression_bps =
  (observed - baseline) / baseline × 10_000` exceeds the
  `REGRESSION_TOLERANCE_BPS = 500` (5 %) directive bound.
  Improvements pass silently; net-new benchmarks surface as
  `orphan_observations` so green CI can't hide a missing baseline.
- `bin/atlas-bench-check` — CI driver: `--baseline <path>`
  `--observations <path>` `--report <path>`; exits non-zero on any
  regression.

### Programs migration plan (`programs/MIGRATION.md`)

End-to-end Pinocchio + zero-copy playbook for the four programs that
will move (`atlas_verifier`, `atlas_rebalancer`, `atlas_alt_keeper`,
`atlas_vault` — vault stays Anchor; registry stays Anchor). Documents
the per-program deltas, sequencing (alt-keeper first, then verifier,
then rebalancer), CI shape (Mollusk bench + lints +
`DeterminismCheck`), and tracking issues.

### Phase 7.1 telemetry

`atlas-telemetry` adds 3 metrics:
- `atlas_receipt_tree_root_age_slots` (Histogram, p99 SLO ≤ 600).
- `atlas_pyth_post_first_ix_violations_total` (Counter, hard alert).
- `atlas_mollusk_regression_bps{program, ix}` (Histogram, CI fails
  > 500 bps).

### Test coverage

- atlas-receipt-tree: 13/13 (leaf 2, depth 2, tree 4, proof 3, plus
  shared bounds).
- atlas-pyth-post: 11/11 (freshness 5, schedule 3, bundle 5; minus
  one shared empty case).
- atlas-mollusk-bench: 8/8 (baseline 3, report 5).
- Workspace total: **546 tests** green (32 new vs Phase 7.0).

### Open

`programs/` Pinocchio + zero-copy migration tracked in
`programs/MIGRATION.md`. Lands in the on-chain Cargo workspace, not
this one.

## Unreleased — Phase 7.0 (2026-05-06) — Directive 07 (Solana runtime, MEV, CPI, ALT)

Five new crates land the directive's off-chain support code. The
on-chain Pinocchio + zero-copy migration touches `programs/` (excluded
from this workspace) and lands in a separate change.

### `atlas-runtime` — runtime constraints (§1, §2.3, §3, §9-§11)

- `locks::AccountLockSet` — sorted writable + readonly sets, `union`,
  `within_writable_slo` (≤ 64 per directive §1.3),
  `lock_collision_set` for the cross-vault writable check (§1.2).
- `tx_size` — `TX_SIZE_LIMIT = 1232`, `TX_SIZE_BUDGET_BYTES = 1180`
  (operational), `MAX_TX_PER_BUNDLE = 5`, ALT count range 1..=4.
  `validate_bundle` rejects oversize tx, too-many-tx, and bad ALT
  counts.
- `compute_budget::ComputeBudgetIxs` — encodes `set_compute_unit_limit`
  + `set_compute_unit_price` byte sequences without pulling
  `solana-sdk`. `CuPredictor::forecast` adds a 15 % safety margin to
  per-step CU baselines and clamps at the 1.4M hard cap.
  `validate_drift(predicted, used)` enforces the §10 ±1500 bps SLO.
- `zero_copy::assert_pod_layout` + `hex_round_trip` — pin size,
  alignment, and byte layout of hot-path account types so a field
  reorder or endian flip fails the test.
- `lints` — `check_readonly_discipline` (flags ix declarations whose
  declared writables are never mutated), `lint_no_borsh_on_hot_path`
  (substring scan over `cargo tree` output), `lint_disallowed_methods`
  (flags `Clock::unix_timestamp`, `sysvar::Slot`, `.to_string(`,
  `format!` in handler source).
- `determinism::DeterminismCheck` — runnable §9 audit over program
  source files; flags `Clock::unix_timestamp`, `sysvar::Slot::id`,
  and `rand::*`.

### `atlas-alt` — ALT lifecycle (§2)

- `lifecycle::AltRecord` — `Pending → Warm → Refreshing → Deactivated`
  state machine. `mark_warm(slot)` requires `slot >
  created_at_slot + WARM_SLOT_DELAY` (§2.2 second bullet).
  `is_referenceable()` returns `true` only for `Warm`.
- `alt_id(sorted_accounts) = blake3("atlas.alt.v1" || sorted_set)` —
  identical sets across vaults reuse the same ALT.
- `extend_chunks(accounts)` splits into ≤ 30-element chunks
  (`extend_lookup_table` on-chain limit).
- `compaction::compaction_candidates` ranks warm-ALT pairs whose
  Jaccard ≥ 80 % (`COMPACTION_THRESHOLD_BPS = 8_000`); each candidate
  carries the merged ALT id and account count.

### `atlas-cpi-guard` — CPI isolation (§4)

- `allowlist::ALLOWLIST` — fixed 9-program slice covering the
  directive's set (Kamino, Drift, Jupiter, Marginfi, Token, Token-2022,
  ATA, Compute Budget, Memo). `is_allowlisted(program_id)` returns
  `Option<AllowlistedProgram>`.
- `ownership::check_owner(pubkey, expected, observed)` — pre-CPI
  owner re-derivation guard (§4.2 third bullet).
- `snapshot::AccountSnapshot { pubkey, lamports, owner, data_hash }` —
  data hashed via blake3 so diffs don't expose raw bytes.
  `diff_snapshots(pre, post, allowed_fields)` returns
  `Vec<SnapshotDiffViolation>` with kinds:
  `UnauthorizedLamports / DataMutation / OwnerChange`,
  `AccountMissingPostCpi`, `AccountAppearedPostCpi`. Empty list ⇒
  I-10 invariant passed.

### `atlas-bundle` — dual-route keeper (§6)

- `idempotency::bundle_id(public_input_hash, allocation_root,
  keeper_nonce) = blake3(...)`. `IdempotencyGuard` short-circuits
  duplicate submissions before they reach the wire.
- `route::Route { Jito, SwQos }` + `RouteOutcome { Landed, Dropped,
  RevertedOnLand }` + `RouteRecord` for per-attempt bookkeeping.
- `region::RegionEma` — exponentially-weighted landed-rate per
  `(route, region)`, drives `best_region(route)`. 5 Block Engine
  regions (Frankfurt, NewYork, Tokyo, Amsterdam, SaltLakeCity).
- `tip::TipOracle` — sliding window of observed tips; `next_tip(cap)`
  returns the configured quantile (default p75) clamped to per-bundle
  + 24h caps. Static tips are §11 anti-pattern; this enforces dynamic
  derivation from the leader-slot distribution.

### `atlas-mev` — MEV detection (§7)

- `exposure::compute_exposure_score(block_window)` — finds Atlas's
  bundle, pulls ±4 adjacent transactions, computes
  `pool_overlap_bps` and a `bracket_signature` (blake3 over sorted
  adjacent-tx signatures so the forensic engine can dedup repeated
  fingerprints). `score_bps = pool_overlap_bps × adjacency_factor`.
- `anomaly::MevAnomaly { kind, vault_id, slot, bundle_id, score }`
  with three kinds: `AdjacentSandwichSuspected`,
  `PostTradeSlippageExceeded`, `PriorSlotFrontRun`. Orchestrator
  wraps these into Phase 05 forensic signals.

### Phase 07 telemetry (directive §10)

`atlas-telemetry` adds 8 metrics:
- `atlas_runtime_cu_used` (Histogram, p99 SLO ≤ 1.2M).
- `atlas_runtime_cu_predicted_vs_used_drift_bps` (Histogram, ±1500
  SLO).
- `atlas_runtime_tx_size_bytes` (Histogram, p99 SLO ≤ 1180).
- `atlas_runtime_bundle_atomicity_violations_total` (Counter,
  hard alert).
- `atlas_runtime_cpi_post_condition_violations_total{pubkey,
  violation_kind}` (Counter, hard alert).
- `atlas_runtime_alt_misses_total` (Counter, hard alert).
- `atlas_runtime_bundle_landed_rate_bps{route}` (Gauge, SLO ≥ 9_500).
- `atlas_runtime_writable_accounts_per_bundle` (Histogram, p99 ≤ 64).

### Runbook

`ops/runbooks/runtime.md` — triage table (CU exhaustion, drift, tx
size, atomicity, CPI post-condition, ALT miss, landed rate), per-area
operations (write-lock discipline, ALT lifecycle, CPI isolation,
dual-route keeper, MEV detection), and the §11 anti-pattern checklist
mapped to runnable lints.

### Test coverage

- atlas-runtime: 32/32 (locks 5, tx_size 5, compute_budget 6,
  zero_copy 4, lints 7, determinism 3, plus shared types).
- atlas-alt: 13/13 (lifecycle 6, compaction 5, alt_id 2).
- atlas-cpi-guard: 13/13 (allowlist 3, snapshot 6, ownership 2,
  shared 2).
- atlas-bundle: 17/17 (idempotency 3, route 1, region 3, tip 5).
- atlas-mev: 5/5 (exposure 4, anomaly 1).
- Workspace total: **514 tests** green (74 new vs Phase 6.1).

## Unreleased — Phase 6.1 (2026-05-06) — Directive 06 §3.1 + §4 + §7 closeout

### Sandbox database mirror (`atlas_sandbox::db`)

- `SandboxTable` enum mirrors all 7 production warehouse tables
  (`rebalances`, `account_states`, `oracle_ticks`, `pool_snapshots`,
  `agent_proposals`, `events`, `failure_classifications`). Each
  variant exposes its `prod_name()` and `sandbox_name()` (always
  `sandbox_<prod>`). Parity test pins the count — adding a new
  production table without a sandbox mirror fails the build.
- `enforce_sandbox_uri(uri)` rejects `s3://` / `clickhouse://`
  loudly, passes through `sandbox://` and `mock://`, and prefixes
  unknown shapes so a sandbox row can never be confused with prod.
- `enforce_sandbox_topic(topic)` forces the `sandbox.` prefix on
  event topics; idempotent.

### Mandatory test corpus (`atlas_sandbox::corpus`)

- `CorpusRequirement` enumerates the five §4 gates:
  `HistoricalReplay`, `ChaosSuite`, `AbCompareApproved`,
  `LeakageProbe`, `Determinism`.
- `CorpusReport::record(req, passed, detail, report_uri)` and
  `all_pass()` / `missing_or_failing()` produce the artifact CI
  attaches to the `Draft → Audited` transition.
- `atlas-registryctl audit` now requires `--corpus-report <path>` and
  refuses the audit if `model_id` doesn't match or any requirement is
  missing/failing on a `Pass` verdict.

### `atlas-governance` — multisig approval flow (§3.1)

- New crate. `SignerSet { pubkeys, threshold }` with sorted /
  deduplicated pubkey storage and `signer_set_root` — binary blake3
  merkle over leaves padded to next power of two; matches the
  Bubblegum commitment shape used elsewhere in Atlas.
- `ApprovalProposal::register_signer` is idempotent; transitions the
  decision from `Pending` to `Ready` once the threshold is reached.
  `submit()` returns a `ProposalSubmission { proposal_id, model_id,
  prev_status, new_status, slot, signer_set_root, signers }` matching
  the registry's `RegistryAnchor` shape so Bubblegum anchoring is a
  one-step write. Finalised proposals reject further `register_signer`
  / `submit` calls — replay protection on the orchestrator side.
- `proposal_id` = `blake3("atlas.gov.proposal.v1" || model_id ||
  prev_status_byte || new_status_byte || slot_le)`. Tests pin
  determinism and distinct ids per transition.

### `atlas-monitor` — drift → alert wiring (§2.4 + §5)

- New crate bridging `atlas-registry` drift signals to the
  `atlas-alert` engine. `MonitorWindow` carries paired (predicted,
  realised) APY series, defensive baseline + observed rate, and the
  agent confidence series; `DriftMonitor::observe(window, engine,
  sink)` evaluates drift and dispatches one alert per `DriftAlert`.
- All `DriftAlert` variants currently funnel into
  `AlertKind::DegradedModeEntered` (Notify class) — sustained drift
  escalates via the registry `DriftFlagged → Slashed` path which is
  governance-driven, not auto.
- The 60-s dedup on the alert engine is what stops drift floods —
  pinned by a test that fires the same drifty window 3× and asserts
  exactly one dispatched alert.
- `bin/atlas-monitorctl` reads a JSON `MonitorWindow` and writes the
  drift report + dispatched alert bodies to `--output`.

### Test coverage

- atlas-sandbox: 34/34 (10 new — corpus 5, db 5).
- atlas-governance: 15/15 (signer set 7, proposal 8).
- atlas-monitor: 3/3 (clean / drifty / dedup).
- atlas-registry: 30/30 unchanged.
- Workspace total: **440 tests** green (28 new vs Phase 6.0).

## Unreleased — Phase 6.0 (2026-05-06) — Directive 06 §1–§3 (Sandbox / Registry / Governance)

### Two new crates

- **`atlas-sandbox`** — strategy sandbox (directive §1).
  - `isolation::SandboxGuard` — runtime barrier rejecting production
    warehouse URIs (`s3://atlas/...`, `clickhouse://atlas-prod/...`),
    mainnet RPC endpoints, and production key paths
    (`~/.config/solana/`, anything under `/prod/` or matching
    `mainnet`). Sandbox URIs are accepted only with the `sandbox://` or
    `mock://` prefix.
  - `leakage::LeakageProbe` — point-in-time enforcement (§1.3) plus the
    random-shuffle probe (§4). Records `LeakageViolation` rows for
    `FutureFeature` (observed_at_slot > as_of_slot) and
    `ShuffleProbeFailed` (shuffled MAE within tolerance of unshuffled).
  - `whatif::WhatIfPlan` — parses the directive's CLI shapes for
    `--override agent.X.weight=0`, `--override threshold.X=0.10`,
    `--inject scenario:...,asset:...,bps:...,duration_slots:...`,
    `--allocation-floor protocol:X,bps:0`. Fractional values are
    converted to bps (`0.10 → 1_000`).
  - `backtest::BacktestEngine<D: BacktestDriver>` — drives the Phase 01
    pipeline in `replay=true` mode against a slot range. Runs the
    isolation guard before any work, threads every feature read through
    `LeakageProbe`, and aborts on the first hard violation. Emits a
    `BacktestReport { report_id, guard, config, rebalances, aggregate,
    leakage_violations }`. `report_id` is content-addressed by
    `(strategy_hash, model_hash, vault_template_hash, slot_range)` —
    determinism contract from §4 pinned by a 5×-run byte-identical test.
  - `compare::paired_bootstrap_ci` — paired bootstrap on the difference
    of means using SplitMix64 RNG; deterministic for a given seed.
    `MetricDelta` reports value_a, value_b, delta, 95% CI low/high, and
    a `significant_at_95` flag.
  - `bin/atlas-sandbox` — CLI with three subcommands: `backtest`,
    `whatif`, `compare`. `whatif` XORs the plan hash into the model hash
    so determinism is preserved.

- **`atlas-registry`** — model registry + governance (directive §2-§3).
  - `record::ModelRecord` — full §2.1 schema: `model_id` (blake3),
    `ensemble_hash`, `created_at_slot`, `trainer_pubkey`,
    `training_dataset_hash`, `training_config_hash`,
    `feature_schema_version` + `feature_schema_hash`, `parent_model_id`,
    `performance_summary`, `status`, `audit_log`, `on_chain_anchor`.
    `validate(is_genesis)` enforces: non-genesis → parent present;
    `Audited`/`Approved` → at least one Pass audit; `Approved` →
    `performance_summary` present; trainer ≠ auditor (§6 anti-pattern).
    `check_content_address(bytes)` verifies `model_id == blake3(bytes)`.
  - `lineage::validate_lineage` — DAG check: unique IDs, exactly one
    genesis, dangling parents rejected, cycle detection via parent walk.
  - `feature_schema::FeatureSchema` + `verify_feature_schema(model_v,
    model_h, runtime)` — version + hash both required (same version
    with different hash is a deployment bug). Canonical hash sorts
    fields by name, so field order is invariant.
  - `drift::evaluate_drift` — combines `mae_bps` (rolling 7d/30d),
    defensive trigger spike vs `DefensiveBaseline.trigger_rate_per_kslot`
    × `defensive_trigger_max_multiplier`, and `brier_score_bps` against
    `DriftThresholds`. Defaults: 200 bps MAE-7d, 150 bps MAE-30d, 3×
    defensive multiplier, 4_000 bps Brier.
  - `anchor::anchor_leaf(&RegistryAnchor)` — canonical Bubblegum leaf
    bytes for status transitions. Schema: `b"atlas.registry.anchor.v1"`
    + model_id + prev_status_byte + new_status_byte + signer_set_root +
    slot_le. Distinct transitions ⇒ distinct leaves; deterministic.
  - `store::ModelRegistry` trait + `InMemoryRegistry` — status-transition
    invariants (`Draft → Audited → Approved → DriftFlagged|Deprecated|
    Slashed`, plus `DriftFlagged → Approved` recovery and `Audited →
    Slashed` for proven-leak audits). `Slashed` is terminal.
  - `bin/atlas-registryctl` — operator CLI: `register`, `audit`,
    `approve` (with required performance-summary fields), `flag-drift`,
    `slash`, `lineage`. Persists records + anchors to a JSON store at
    `--db ops/registry/registry.json`.

### Phase 06 telemetry (directive §5)

`atlas-telemetry` adds 5 metrics:
- `atlas_sandbox_backtest_runtime_minutes{range_class}` (Histogram, p95
  SLO ≤ 30 min on 90-day range).
- `atlas_sandbox_leakage_violations_total{kind}` (Counter, hard alert
  on any).
- `atlas_sandbox_determinism_violations_total{vault_id, replay}`
  (Counter, hard alert on any).
- `atlas_registry_unaudited_in_production_total{vault_id, replay}`
  (Gauge, must be 0).
- `atlas_registry_drift_flagged_models_total{model_family}` (Gauge,
  dashboarded).

### Runbook

- `ops/runbooks/model-approval.md` — end-to-end approval flow per §3.
  Documents trainer/auditor/governance key separation,
  `atlas-registryctl` invocations for each stage, the §4 mandatory
  sandbox suite (90-day replay × 3 regimes, chaos suite, A/B compare,
  leakage probe, 5× determinism check), and the slashing path with
  Phase 05 SecurityEvent linkage.

### Test coverage

- atlas-sandbox: 24/24 (isolation, leakage, what-if parsing, aggregate
  metrics, report id determinism, backtest happy path + leakage abort
  + production URI rejection + inverted range + 5× byte-identical
  determinism, paired bootstrap CI shape + variance + seed determinism).
- atlas-registry: 30/30 (record content addressing + validation +
  trainer self-audit guard, lineage DAG validation across all 5 failure
  modes, feature schema field-order invariance + version/hash
  mismatches, drift report flagging across all 4 alert kinds, anchor
  leaf distinctness + slot sensitivity + determinism, store happy path
  + illegal transitions + duplicate insert + slashed terminality +
  drift recovery).
- Workspace total: **412 tests** green (54 new vs Phase 5.1).

## Unreleased — Phase 5.1 (2026-05-06) — Directive 05 §4–§8 (Alerts / Capital Efficiency / Runbooks)

### Two new crates

- **`atlas-alert`** — autonomous alert engine (directive §4).
  - 11 typed `AlertKind` variants across the three classes the directive
    mandates: 5 `Page` (archival, hard quorum, post-condition, prover
    down, security event), 5 `Notify` (degraded mode, defensive mode,
    oracle deviation, consensus disagreement, source quarantine), 1
    `Digest` (daily). `class()` and `template_path()` are
    compile-time exhaustive — adding a kind without a template fails to
    build.
  - `engine::AlertEngine` — dedup over a 60 s window per
    `(class, vault_id, kind)` collapsing to one fire with `[xN]` count
    re-emitted on the next fire; auto-resolve after K=8 consecutive
    `observe_clear()` calls; maintenance windows that suppress
    non-security pages while always firing security pages.
    `pages_dispatched` / `pages_suppressed` counters back the
    `atlas_alerts_page_per_day` SLO.
  - `render::render_alert` — substitutes `{key}` placeholders from
    `Alert.fields`. Missing keys render as `<missing>` with a
    `template.missing_field` warning span — visible incompleteness beats
    silent suppression. `{{` / `}}` escape literal braces. Free-form
    text is impossible at the API: every dispatched alert flows through
    this function.
  - `sink::AlertSink` trait + `AlertDispatcher` — class-aware fan-out.
    `NoopSink` for tests, `RecordingSink` for assertion. Production
    PagerDuty/Slack webhooks wired by reading
    `ops/secrets/{pagerduty,slack}.url`.
  - `bin/atlas-alertctl` — operator CLI with two subcommands:
    `maintenance set/list` persists `MaintenanceWindow`s to
    `ops/secrets/maintenance.json`; `render --kind X --field key=val ...`
    renders a template locally for runbook QA without dispatching.

- **`atlas-capital`** — capital efficiency engine (directive §5).
  - 7 metrics per epoch:
    - `idle_capital_share_bps` — averaged `(idle, tvl)` ratio.
    - `realized_apy_bps` — Money-Weighted Rate of Return solved by
      Newton-Raphson on the cash-flow series, annualised, signed.
    - `expected_apy_bps` — `Σ allocation × oracle_apy` with allocation
      summing to 10_000 (rejected otherwise).
    - `yield_efficiency_bps` — realized / expected, capped at
      2× BPS_DENOM.
    - `rebalance_cost_bps` — `(gas + tip + slippage) / tvl`.
    - `rebalance_efficiency_bps` — `realized / (realized + cost)`.
    - `defensive_share_bps` — defensive_slots / total_slots.
  - `rollup(EpochInputs)` aggregates all seven into a `CapitalEpoch`
    record consumed by the daily digest template + the public
    transparency page.
  - Pure (no I/O); all inputs come from the warehouse. Replay parity
    guaranteed.

### Alert templates (`ops/alerts/templates/*.txt`)

10 templates, one per `AlertKind` (defensive + degraded share one body):

- `archival_failure.txt`, `quorum_disagreement.txt`,
  `post_condition_violation.txt`, `prover_network_down.txt`,
  `security_event.txt` — Page class.
- `defensive_mode_entered.txt`, `oracle_deviation.txt`,
  `consensus_disagreement_spike.txt`, `source_quarantine.txt` —
  Notify class.
- `digest_daily.txt` — Digest class, includes the 7 capital efficiency
  fields.

Templates are inlined via `include_str!` so a missing file fails the
build, and each template is parsed by `template_fields()` in the test
suite (verifies balanced braces).

### Runbooks (`ops/runbooks/*.md`)

7 runbooks, one per `FailureClass` category, with triage steps,
decision trees, and explicit anti-pattern lists:

- `ingestion.md` (1xxx), `oracle.md` (2xxx), `inference.md` (3xxx),
  `proof.md` (4xxx), `execution.md` (5xxx), `archival.md` (6xxx),
  `adversarial.md` (7xxx). `README.md` indexes them. Every page-class
  alert template references the relevant runbook so oncall lands on the
  right page in a single click.

### `ops/secrets/` layout

- `.gitignore` excludes everything except itself and `README.md`.
- README documents the 5 file-name convention used by the orchestrator
  (`pagerduty.url`, `slack.url`, `discord.url`, `digest.url`,
  `maintenance.json`) and the rotation procedure.

### Test coverage

- atlas-alert: 11/11 (kinds, render, dedup, maintenance, auto-resolve).
- atlas-capital: 13/13 (idle share, expected APY, MWRR positive +
  drawdown + infeasible, yield efficiency clamps, rebalance cost +
  efficiency, defensive share, full rollup).
- Workspace total: **358 tests** green (24 new vs Phase 5 §1–§3).

## Unreleased — Phase 5.0 (2026-05-05) — Directive 05 §1–§3 (Forensic / Failure / Black Box)

### Three new crates

- **`atlas-forensic`** — on-chain forensic engine (directive §1).
  - `signal::ForensicSignal` enum: 5 variants — `LargeStableExit`,
    `WhaleEntry`, `LiquidationCascade`, `SmartMoneyMigration`,
    `AbnormalWithdrawal`. Each carries protocol/wallet/amount/slot. Stable
    `signal_id` = blake3(canonical bytes) for content-addressed dedup.
  - `heuristics`: `ProtocolFlowTracker` (large exit / whale entry threshold),
    `LiquidationCascadeTracker` (rolling 1-min window, default 8 events),
    `SmartMoneyMigrationTracker` (≥50% wallet-fraction shift), and
    `AbnormalWithdrawalTracker` driven by `WelfordOnline` mean+variance.
    Default config: 5σ threshold, 32-sample minimum.
  - `engine::ForensicEngine` composes the four trackers with `observe_*`
    methods. Emits `Vec<ForensicSignal>` per event. Tests pin all five
    signal kinds firing under their canonical conditions.

- **`atlas-failure`** — pipeline failure taxonomy (directive §2).
  - `class::FailureClass` enum — 24 variants across 7 categories:
    Ingestion (1xxx), Oracle (2xxx), Inference (3xxx), Proof (4xxx),
    Execution (5xxx), Archival (6xxx), Adversarial (7xxx). `VariantTag`
    carries stable u16 codes; `category_prefix()` yields the directive
    category number.
  - `remediation::remediation_for(&FailureClass) -> Remediation` —
    `pub const fn` exhaustive match. 15 `Remediation` variants
    (`HaltAndPage`, `FailoverAndRetry`, `Defensive`,
    `RejectAndSecurityEvent`, etc.) with stable `RemediationId` strings
    like `rem.archival.failed.abort`. 25 unique IDs pinned by test.
    Compile-time exhaustiveness — adding a class without a remediation
    fails to build.
  - `log::FailureLogEntry { slot, vault_id, stage, class, variant_tag,
    remediation_id, message_hash, recovered_at_slot }`. `message_hash`
    is `blake3(error.to_string())` for content dedup; `mark_recovered`
    sets the recovery slot.

- **`atlas-blackbox`** — rebalance forensic recording (directive §3).
  - `record::BlackBoxRecord` schema (§3.1) — 26 fields, every required
    surface present. `validate()` enforces: schema == `atlas.blackbox.v1`;
    landed → `after_state_hash` + `balances_after` + `tx_signature` +
    `landed_slot` present and `failure_class` absent; aborted/rejected →
    no `after_state_hash` and `failure_class` present;
    `balances_before`/`after` equal length; cpi_trace step indices 1-based
    monotonic; no failed post-conditions; `public_input_hex` exactly
    536 chars. **Anti-pattern §7 enforced**: silent null substitution
    rejects.
  - `write::write_record(&dyn WarehouseClient, &BlackBoxRecord)` — async
    write path. Validates first, converts to `RebalanceRow` (allocation
    bps derived from balances_after totals), then inserts. Invalid
    records are rejected before the DB.
  - `bin/atlas-inspect` CLI — `atlas-inspect --hash <PUBLIC_INPUT_HASH>`
    emits a single JSON document with `balances_diff`,
    `cpi_trace_summary`, `failed_invariants`, timings, status,
    explanation/proof URIs, and a Bubblegum-proof status placeholder
    (Phase 6 wires the live Merkle path). Optional `--fixture <path>` for
    offline testing of the JSON contract.

### Phase 05 telemetry (directive §6)

- `atlas-telemetry` adds 5 metrics:
  - `atlas_forensic_signal_lag_slots{kind}` (Histogram, p99 SLO ≤ 8 slots)
  - `atlas_failure_uncategorized_total{stage}` (Counter, hard alert any)
  - `atlas_alerts_page_per_day{category}` (Gauge, SLO ≤ 5/day)
  - `atlas_blackbox_record_completeness_violations_total{reason}`
    (Counter, hard alert any)
  - `atlas_capital_idle_share_bps{vault_id, replay}` (Gauge, p95 SLO ≤ 2_000)

### Test coverage

- atlas-forensic: 16/16. atlas-failure: 10/10. atlas-blackbox: 13/13.
  Remediation IDs are unique (25); every FailureClass maps to a
  Remediation; pages-oncall and security-event predicates pinned;
  Welford matches textbook variance to 1e-9.
- Workspace total: **334 tests** green.

## Unreleased — Phase 4.1 (2026-05-06) — Directive 04 closeout (§3.4–§5)

### Bridge: exposure topology hash → public input

- `atlas_exposure::combined_risk_state_hash(pipeline_hash, exposure_hash)` —
  domain-tagged blake3 helper that lands in `public_input.risk_state_hash`.
  Tests pin: changing either component changes the combined hash;
  deterministic across runs.

### Anti-pattern enforcement (directive §4)

- **`atlas_lie::source` module** — type-level barrier against live quotes
  in the commitment path. `WarehousePinnedSource` marker trait is required
  by `require_pinned`. `LiveJupiterQuote` and `LiveBirdeyeDepth` exist for
  monitoring/dashboards but explicitly do **not** implement the marker.
  Documented compile-time enforcement.
- **`atlas_ovl::cex_guard::CexReference`** — Birdeye CEX price wrapper.
  No `Serialize`, no commitment-hash method. Only operation:
  `agrees_with(consensus, band)` for sanity guarding (sets the
  `CEX_DIVERGE` flag without altering `consensus_price_q64`).
- **`atlas_ovl::verifier::verify_posted_update`** — pure off-chain mirror
  of the Phase 5 on-chain Pyth read CPI. Reaffirms freshness gate
  (posted_slot ≥ bundle_target_slot − 4) and returns `VerifiedPrice`. Same
  function called both in the commitment path and on-chain — replay parity.
- **`GraphRevision` + `assert_current`** in `atlas_exposure` — refuses to
  consume a stale graph in the commitment path. Three failure modes pinned:
  unstamped graph, drifted protocol set, age exceeded.

### Adversarial test fixtures (`tests/oracles/`)

- New integration crate `atlas-oracle-tests` with all directive §2.5
  scenarios as named fixtures:
  - `single_source_manipulation_rejects` — only Pyth pumps; consensus rejects.
  - `synchronized_push_degrades_confidence` — Pyth + SB move, TWAP doesn't;
    `TWAP_DIVERGE` flag, confidence falls to 5_000.
  - `replayed_price_update_rejected` — keeper + verifier both reject an
    update at slot 100 against bundle slot 1_000.
  - `stale_pyth_with_perfect_agreement_still_defensive` — agreement is
    not freshness; defensive triggers anyway.
  - `pull_oracle_boundary_4_slot_lag_verifies` — boundary verifies; 5-slot
    lag rejects.

### Grafana dashboard (`ops/grafana/atlas-phase04.json`)

- Phase 04 dashboard wired to all 7 metrics with directive thresholds:
  - OVL consensus confidence (red < 6_500, yellow < 7_000, green ≥ 7_000)
  - OVL deviation p99 (red ≥ 200, yellow ≥ 80)
  - LIE snapshot lag p99 (red ≥ 4)
  - LIE fragmentation p95 per pair
  - Per-asset oracle deviation timeseries
  - Toxicity high-pool count rolling 1h
  - Stale Pyth + defensive trigger timeseries

### Tests added (20)

| Module | Tests |
|---|---|
| atlas-exposure::graph (revision/staleness) | 4 |
| atlas-exposure (combined_risk_state_hash) | 2 |
| atlas-lie::source | 2 |
| atlas-ovl::cex_guard | 3 |
| atlas-ovl::verifier | 4 |
| tests/oracles | 5 |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 59 |
| atlas-warehouse | 36 |
| atlas-warehouse-tests | 6 |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| atlas-lie | 19 (was 17) |
| atlas-ovl | 25 (was 18) |
| atlas-exposure | 16 (was 10) |
| **atlas-oracle-tests** | **5** (new) |
| **Total** | **295** (was 275) |

### Directive 04 §5 deliverable checklist — final closeout

| Item | Status |
|---|---|
| `atlas-lie` crate w/ typed `LiquidityMetrics`, deterministic | ✅ |
| Toxicity scorer w/ documented heuristics + unit tests | ✅ |
| `atlas-ovl` crate w/ `OracleConsensus`, pull-oracle keeper, freshness gate | ✅ |
| Pyth pull-oracle integration: posting + verifier read pattern | ✅ off-chain mirror via `verify_posted_update` |
| Cross-protocol dependency graph builder w/ `risk_state_hash` derivation | ✅ + `combined_risk_state_hash` bridge |
| Adversarial test fixtures (stale-Pyth, synchronized-push, replayed-price-update) | ✅ `tests/oracles/` integration crate |
| Dashboards for deviation distribution, toxicity, fragmentation | ✅ `ops/grafana/atlas-phase04.json` |

**Directive 04 closed.**

---

## Unreleased — Phase 4 (2026-05-06) — Liquidity Microstructure + Oracle Validation + Exposure (directive 04)

### atlas-lie crate (§1 Liquidity Intelligence Engine)

- `metrics::LiquidityMetrics` — typed per-pool, per-slot output: depth at
  ±1% / ±5% in Q64.64, 9-point slippage curve, fragmentation index in bps,
  velocity in Q64.64-per-slot, toxicity score in bps, snapshot hash.
- `quantize_q64` / `quantize_q64_signed` — deterministic round-half-up to
  the 1/2^32 grid before commitment hashing (§1.5).
- `snapshot_hash` — domain-tagged blake3 over the canonical layout.
- `fragmentation::fragmentation_index_bps` — `10_000 - HHI` in pure
  integer-bps math. Empty / monolithic / split-N families covered.
- `toxicity::ToxicityScorer` — weighted combination of reversal rate,
  inventory skew, LP-withdrawal velocity, and sandwich-pair count over a
  256-slot rolling window. Returns `ToxicityClass` (Clean / Warn /
  Excluded). Thresholds match directive: `T_TOXIC_BPS = 6_500`,
  `T_TOXIC_WARN_BPS = 4_000`.
- `depth::SlippageCurveBuilder` — builds the fixed 9-point ladder
  `[-5%, -2%, -1%, -0.5%, 0, +0.5%, +1%, +2%, +5%]` from a caller-provided
  warehouse-pinned depth lookup. Quantizes outputs.

### atlas-ovl crate (§2 Oracle Validation Layer)

- `consensus::derive_consensus(input) -> OracleConsensus` — pure, replayable
  implementation of the §2.2 selection algorithm:
  - ≤30 bps and not stale → median, confidence 9_500
  - 30–80 bps → median, confidence linear-degraded to 7_000
  - 80–200 bps → fall back to Pyth iff conf < 50 bps; otherwise defensive
  - >200 bps OR any feed stale OR low-TWAP-confidence → defensive
- `OracleFlags` bitset (`STALE_PYTH | STALE_SB | TWAP_DIVERGE | CEX_DIVERGE
  | LOW_CONFIDENCE | DEFENSIVE_TRIGGER`).
- `freshness::is_stale_pyth` (>25 slots) / `is_stale_switchboard` (>30 slots).
- `keeper::PullOracleKeeper` + `validate_posted_update` — implements §2.4:
  posted price-update slot must be `≥ bundle_target_slot − 4`. Replay
  attack (re-using an old update) is explicitly rejected by
  `validate_for_bundle`. Tests pin every adversarial case from §2.5.

### atlas-exposure crate (§3 Cross-Protocol Exposure Engine)

- `ProtocolDependencyGraph` — typed nodes (`Protocol`, `Asset`, `Oracle`,
  `Liquidator`) + 4 edge kinds (`ProtocolUsesAsset`, `ProtocolUsesOracle`,
  `ProtocolSharesLiquidator`, `AssetCorrelated`).
- `effective_exposures(allocation_bps)` — BFS with `PATH_DECAY_BPS = 7_000`
  per hop and edge weight, computing the directive's
  `eff_exposure(e) = Σ a_i × path_weight(protocol_i → e)`.
- `flags(allocation)` surfaces three §3.3 adversarial patterns:
  `EffectiveOracleConcentration`, `SharedCollateralRisk`,
  `SharedLiquidatorRisk`, plus `AssetCorrelationCluster` for ≥7_000 bps
  correlation edges.
- `topology_hash` — domain-tagged blake3 over sorted+deduped edges; lands
  in `public_input.risk_state_hash` (Phase 01 §8 contract).
- `scenarios::simulate_correlated_liquidation` — applies a `-X%` shock to
  an asset and propagates loss through the graph. Tests confirm shock
  scaling and unrelated-shock-yields-zero invariants.

### atlas-telemetry — Phase 04 SLOs (directive §1.6, §2.6)

- `lie_snapshot_lag_slots` (histogram, label `pool`) — p99 SLO ≤ 4.
- `lie_toxicity_high_pool_total` (counter, label `pool`) — alert on cliff.
- `lie_fragmentation_index_bps` (histogram, label `pair`) — dashboard p95.
- `ovl_deviation_bps` (histogram, label `asset`) — dashboard p99.
- `ovl_stale_pyth_total` (counter, label `asset`) — alert on rate.
- `ovl_defensive_trigger_total` (counter, labels `asset`, `reason`) — alert on rate.
- `ovl_consensus_confidence_bps` (gauge, label `asset`) — p10 SLO ≥ 7_000.

### Tests added (45)

| Module | Tests |
|---|---|
| atlas-lie::metrics | 5 |
| atlas-lie::fragmentation | 5 |
| atlas-lie::toxicity | 5 |
| atlas-lie::depth | 2 |
| atlas-ovl::freshness | 2 |
| atlas-ovl::consensus | 9 (incl. all §2.5 adversarial cases) |
| atlas-ovl::keeper | 7 |
| atlas-exposure::graph | 7 |
| atlas-exposure::scenarios | 3 |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 59 |
| atlas-warehouse | 36 |
| atlas-warehouse-tests | 6 |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **atlas-lie** | **17** |
| **atlas-ovl** | **18** |
| **atlas-exposure** | **10** |
| **Total** | **275** (was 230) |

### Directive 04 §5 deliverable checklist

| Item | Status |
|---|---|
| `atlas-lie` crate w/ typed `LiquidityMetrics`, deterministic | ✅ |
| Toxicity scorer w/ documented heuristics + unit tests | ✅ |
| `atlas-ovl` crate w/ `OracleConsensus`, pull-oracle keeper, freshness gate | ✅ |
| Pyth pull-oracle integration: posting + verifier read pattern | ✅ off-chain side; on-chain read CPI Phase 5 |
| Cross-protocol dependency graph builder w/ `risk_state_hash` derivation | ✅ |
| Adversarial test fixtures (stale-Pyth, synchronized-push, replayed-price-update) | ✅ |
| Dashboards for deviation distribution, toxicity, fragmentation per asset/pool | ✅ metrics registered; Grafana JSON Phase 5 |

**Directive 04 closed.**

---

## Unreleased — Phase 3.2 (2026-05-06) — Directive 03 closeout (§5–§10)

### Bubblegum: real Merkle proofs

- `BubblegumAnchorKeeper` now retains anchored leaves (not just receipts)
  inside `AnchoredBatch { receipt, leaves }`. The previous design
  discarded the leaves on flush, which made `find_proof` impossible.
- New API:
  - `BubblegumAnchorKeeper::find_proof(leaf) -> Option<MerkleProof>`
  - `BubblegumAnchorKeeper::find_proof_for_receipt(bytes) -> Option<MerkleProof>`
  - `BubblegumAnchorKeeper::batches() -> &[AnchoredBatch]`
  - `BubblegumAnchorKeeper::history()` now derives from `batches`.
- Tests cover both happy path (every committed leaf returns a verifying
  proof) and miss path (unknown leaf returns `None`).

### Forensic API: real proof responses

- `GET /rebalance/:hash/proof` now decodes the requested hash and calls
  `keeper.find_proof()`. When the leaf has been anchored, the response
  carries the verifiable Merkle path (leaf, index, siblings, root). When
  it has not, the response still carries `archive_root_slot` + `archive_root`
  so auditors can distinguish "not yet anchored" from "wrong API".
- `decode_hex32` rejects malformed hashes with HTTP 400.

### Retention policy (directive §6)

- New `retention` module: typed `Tier` (Hot / Warm / Cold) +
  `RetentionPolicy` + `directive_baseline()` returning the §6 numbers.
- `validate(policy)` returns `RetentionViolation` if a configured policy
  exceeds Hot's 30-day, Warm's 18-month, or Cold's 60 GB/mo/vault limit.
- Tests pin the directive numbers + reject overages.

### `tests/warehouse/no_leakage.rs` (directive §5)

- New integration test crate `atlas-warehouse-tests` implementing the
  directive's exact mandate: "constructs a synthetic dataset and asserts
  the feature store never returns a value with `observed_at_slot >
  as_of_slot`."
- 6 tests, including:
  - `proptest`-driven leak rejection across 256 random
    `(as_of_slot, offset)` pairs.
  - `proptest`-driven non-leak acceptance across 256 random
    `(as_of_slot, backshift)` pairs.
  - Vector-level atomicity: a single leaked feature poisons the entire
    `FeatureVector::validate` call.
  - Full-day sweep at slot granularity asserting the gate agrees with
    the inequality on every cell.
  - Pin on `MissingAsOf` typed-error path.

### Bubblegum keeper runbook (directive §10)

- `ops/runbooks/bubblegum-keeper.md` documents the on-chain accounts
  (`atlas_archive_tree`, `atlas_archive_authority`, `atlas_keeper`,
  `atlas_keeper_bond`), the directive §9 anti-pattern compliance ("not
  multisig"), the slashing matrix, the routine + emergency rotation
  procedures, and the keeper-specific monitoring signals.

### Tests added (12)

| Module | Tests |
|---|---|
| bubblegum (extra) | 2 (find_proof committed leaf, find_proof unknown leaf) |
| retention | 4 (baseline matches directive, validate accepts baseline, rejects hot retention overrun, rejects cold footprint overrun) |
| atlas-warehouse-tests | 6 (proptest leak rejection, proptest non-leak acceptance, vector-atomicity rejection, full-day sweep, MissingAsOf pin, accepts clean vector) |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 59 |
| atlas-warehouse | 36 (was 30) |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| atlas-warehouse-tests | 6 (new) |
| **Total** | **230** (was 218) |

### Directive 03 §10 deliverable checklist — final closeout

| Item | Status |
|---|---|
| ClickHouse schema migrations | ✅ `db/clickhouse/V001__base_schema.sql` |
| Timescale hypertables | ✅ `db/timescale/V001__base_schema.sql` |
| `WarehouseClient` Rust crate w/ typed inserts + idempotent writes | ✅ |
| Bubblegum anchoring keeper, on-chain root account documented | ✅ off-chain side complete; `ops/runbooks/bubblegum-keeper.md` |
| Forensic HTTP API w/ Merkle-proof responses | ✅ real `find_proof` wired |
| Replay API + Phase 02 integration | ✅ `atlas-warehouse-replay` |
| Point-in-time feature store + leakage tests | ✅ `tests/warehouse/no_leakage.rs` (proptest + sweep + atomicity) |
| Materialized views for the 4 named analytical questions | ✅ |
| Daily backup + monthly restore drill documented | ✅ `ops/runbooks/warehouse-restore.md` |

**Directive 03 closed.**

---

## Unreleased — Phase 3.1 (2026-05-06) — Write-path gate, Bubblegum flusher, forensic queries, replay bin

### atlas-warehouse — write path (directive §3)

- `write_path::archive_then_submit` — canonical I-8 enforcement helper.
  Runs `WarehouseClient::insert_rebalance` first; the submit closure is
  invoked **only** after the archive returns a receipt. On archive failure
  the helper returns `WritePathError::ArchiveFailed`, bumps both
  `atlas_archival_failures_total` (cross-pipeline I-8 alarm) and
  `atlas_warehouse_archive_failure_total{table="rebalances"}` (warehouse
  signal), and the submit closure does not run. Asserted by a unit test
  using a `FailingArchive` impl.
- Write-lag is observed on `atlas_warehouse_write_lag_ms{table="rebalances"}`.

### atlas-warehouse — Bubblegum flusher process (directive §3)

- `flusher::BubblegumFlusher` — long-running tokio task. Receives
  `PendingReceipt`s on an mpsc channel and flushes when:
  1. leaf threshold reached (`flush_every_n_leaves`, default 256), OR
  2. slot threshold reached (`flush_every_n_slots`, default 600), OR
  3. `max_pending_leaves` safety valve fires (default 4096).
- `FlusherHandle::enqueue` is the producer interface — pipeline writers
  feed receipts after a successful archive write.
- Anchor receipts (`BubblegumAnchorReceipt`) are emitted on a dedicated
  channel ready for the on-chain CPI keeper (Phase 4).
- `atlas_warehouse_bubblegum_anchor_lag_slots` observed on every flush.
- Final flush on channel close ensures no leaves are lost on shutdown.
- The slot threshold is anchored to the first receipt seen, not zero, so
  the very first event does not unconditionally force a flush.

### atlas-warehouse — forensic query helpers (directive §4)

- Typed row structs for the 4 named materialized views:
  `RebalanceSummaryDailyRow`, `AgentDisagreementBucket`,
  `FailureClassRateRow`, `ProtocolExposureRow`.
- `ForensicQuery` trait with the 4 query methods used by analyst code.
- `InMemoryForensic` reference impl for tests + dev (real ClickHouse
  driver lands in Phase 4).
- `day_anchor_slot` / `hour_anchor_slot` — anchor a slot to UTC day/hour
  boundaries (216_000 / 9_000 slots respectively at 400 ms cadence).

### atlas-warehouse — feature store extensions (directive §4)

- `FeatureVector { vault_id, as_of_slot, features }` typed return for
  sandbox backtests (Phase 06 consumer).
- `FeatureVector::validate` — pure leakage gate; rejects any element
  with `observed_at_slot > as_of_slot` and bumps the leakage counter.
- `FeatureStoreClient::read_feature_vector_at` — sandbox-mode read that
  validates the returned vector before handing it back. Phase 4 wires
  the ClickHouse predicate; today the typed contract + leakage gate are
  exercised via tests.

### atlas-warehouse-replay binary (directive §4)

- New CLI: `atlas-warehouse-replay --slot S0..S1 [--vault HEX]`.
- Reads events for the slot range from the warehouse and emits one
  JSONL line per event on stdout (`{slot, source, event_id, canonical_hex}`)
  followed by a footer line (`{slot_lo, slot_hi, event_count, elapsed_ms}`).
- Phase 02's `atlas-bus replay --archive` consumes this stream end-to-end.
- Replay query latency observed on `atlas_warehouse_replay_query_ms`.

### Tests added (15)

| Module | Tests |
|---|---|
| write_path | 3 (archive failure blocks submit, archive success invokes submit, submit failure after archive) |
| flusher | 3 (leaf threshold flush, slot threshold flush, final flush on channel close) |
| forensic | 3 (trait impl smoke, day anchor 216k boundary, hour anchor 9k boundary) |
| feature_store (extra) | 3 (vector validate rejects leakage, vector validate passes clean, read_feature_vector_at returns validated vector) |
| replay bin | 3 (parse_slot_range round-trip, parse_slot_range rejects inverted, parse_vault round-trip) |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 59 |
| atlas-warehouse | 30 (was 18) |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **218** (was 203) |

### Directive 03 §3-§4 coverage delta

| § | Item | Status |
|---|---|---|
| §3 | Single `WarehouseClient`; no stage talks to CH/TS/S3 directly | ✓ Phase 3 |
| §3 | Idempotency on `(slot, vault_id, public_input_hash)` for rebalances | ✓ Phase 3 |
| §3 | Idempotency on `event_id` for raw events | ✓ Phase 3 |
| §3 | Receipt returned; rebalance ix gated on archive success | ✓ `archive_then_submit` |
| §3 | Bubblegum anchoring as separate flusher process (every N slots) | ✓ `BubblegumFlusher` |
| §4 | Forensic SQL — typed access to 4 named MVs | ✓ trait surface |
| §4 | Replay API — `atlas-warehouse-replay --slot S0..S1 --vault V` | ✓ |
| §4 | Feature store API — point-in-time, no leakage | ✓ `FeatureVector::validate` |

---

## Unreleased — Phase 3 (2026-05-06) — Intelligence Warehouse (directive 03)

### atlas-warehouse crate

- `schema` — typed Rust rows for all 7 directive §2 tables: `RebalanceRow`,
  `AccountStateRow`, `OracleTickRow`, `PoolSnapshotRow`, `AgentProposalRow`,
  `EventRow`, `FailureClassificationRow`. Stable `RebalanceStatus` enum
  (Proposed/Submitted/Landed/Rejected/Aborted). `OracleSource` enum mirrors
  the SQL `Enum8`. `tx_signature` is `Vec<u8>` because serde does not derive
  `Deserialize` for `[u8; 64]`; insert path asserts `len() == 64`.
- `client` — `WarehouseClient` async trait + `WriteReceipt`. Receipts include
  `idempotent_hit` so callers (Phase 01 stage 16) can distinguish a fresh
  write from a no-op replay. `WarehouseError` taxonomy: Unavailable /
  SchemaMismatch / IdempotencyCollision / Rejected / Poisoned.
- `mock` — `MockWarehouse` in-memory backend implementing the same
  idempotency contract as the real DB. Used by Phase 1/2 tests and the
  forensic API binary in development.
- `bubblegum` — anchoring keeper. `merkle_root` over a leaf list w/ next-
  power-of-two zero padding. `merkle_path` + `verify_path` for auditor-
  side verification without trusting the warehouse API.
  `BubblegumAnchorKeeper` batches receipts every N leaves, emits
  `BubblegumAnchorReceipt { slot_low, slot_high, leaf_count, batch_root }`.
  Domain-tagged hashes (`b"atlas.archive.leaf.v1\0"`,
  `b"atlas.archive.node.v1\0"`) prevent cross-domain collisions.
- `replay` — `replay(client, ReplayQuery { slot_lo, slot_hi })` returns
  `ReplayResponse` w/ events sorted by `(slot, event_id)` for deterministic
  consumption by Phase 02 `atlas-bus replay --archive`.
- `feature_store` — `FeatureStoreClient` enforcing point-in-time discipline
  (directive §5). `assert_no_leak()` rejects any candidate snapshot whose
  `observed_at_slot > as_of_slot` and increments the
  `atlas_warehouse_feature_store_leakage_violations_total` counter.
- `views` — constants for the 4 named materialized views from §4.
- `migrations` — `TABLE_VERSIONS` records the deployed schema version per
  table per engine. Adding a column requires bumping the version + landing
  a SQL migration; CI fails on drift.

### atlas-warehouse-api binary

- Read-only forensic HTTP surface (axum, port 9091 default).
- `GET /vault/:id/rebalances?from=&to=`
- `GET /rebalance/:hash`
- `GET /rebalance/:hash/explanation`
- `GET /rebalance/:hash/proof` — returns `archive_root_slot` + Merkle path
  to the on-chain Bubblegum root. Auditors verify with `verify_path` w/o
  trusting our API.
- `GET /vault/:id/feature-snapshot?slot=`

### SQL migrations

- `db/clickhouse/V001__base_schema.sql` — 6 tables (rebalances, oracle_ticks,
  pool_snapshots, agent_proposals, events, failure_classifications) +
  4 materialized views (`mv_rebalance_summary_daily`,
  `mv_agent_disagreement_distribution`, `mv_failure_class_rate`,
  `mv_protocol_exposure_over_time`). ZSTD codec on JSONB columns.
- `db/timescale/V001__base_schema.sql` — Timescale hypertables for
  `rebalances`, `account_states`, `events`. Compression policies (6h for
  account_states, 24h for events). Retention policy 30 days. Indexes for
  `(vault_id, slot DESC)` and `(pubkey, slot DESC)`.

### atlas-telemetry — Phase 03 SLO metrics (directive §8)

- `atlas_warehouse_write_lag_ms` (histogram, label `table`) — SLO p99 ≤ 800.
- `atlas_warehouse_archive_failure_total` (counter, label `table`) — hard alert.
- `atlas_warehouse_bubblegum_anchor_lag_slots` (histogram) — SLO p99 ≤ 600.
- `atlas_warehouse_replay_query_ms` (histogram, label `range_class`) —
  SLO p99 ≤ 5_000 for 1h ranges.
- `atlas_warehouse_feature_store_leakage_violations_total` (counter) —
  hard alert.

### Operations

- `ops/runbooks/warehouse-restore.md` — daily backup procedure, monthly
  restore drill checklist, full disaster recovery procedure including a
  mandatory cryptographic-integrity check against the on-chain Bubblegum
  root before any production restore.

### Tests added (18)

| Module | Tests |
|---|---|
| schema | 2 (serde round-trip, status_str) |
| mock | 4 (idempotent rebalance writes, idempotency collision, oracle tick idempotency, range scan) |
| bubblegum | 6 (empty root zero, single leaf, two leaves, proof round-trip 7 leaves, batches at threshold, partial flush, deterministic across runs) |
| replay | 1 (range query sorted by slot) |
| feature_store | 2 (leakage rejected, non-leaky passes) |
| migrations | 2 (every directive table has a version, unknown returns None) |
| api binary | — (axum, smoke-tested at runtime) |

### Test counts

| Crate | Tests |
|---|---|
| atlas-public-input | 5 |
| atlas-pipeline | 82 |
| atlas-telemetry | 3 |
| atlas-replay | 20 |
| atlas-bus | 59 |
| atlas-warehouse | 18 |
| atlas-invariants-tests | 6 |
| atlas-adversarial-tests | 10 |
| **Total** | **203** (up from 185) |

### Directive 03 §10 deliverable checklist

| Item | Status |
|---|---|
| ClickHouse schema migrations | ✓ `db/clickhouse/V001__base_schema.sql` |
| Timescale hypertables | ✓ `db/timescale/V001__base_schema.sql` |
| `WarehouseClient` Rust crate w/ typed inserts + idempotent writes | ✓ |
| Bubblegum anchoring keeper, on-chain root account documented | ✓ off-chain side; on-chain CPI Phase 4 |
| Forensic HTTP API w/ Merkle-proof responses | ✓ `atlas-warehouse-api` |
| Replay API + integration w/ Phase 02 `atlas-bus replay` | ✓ |
| Point-in-time feature store + leakage tests | ✓ |
| Materialized views for the 4 named analytical questions | ✓ |
| Daily backup + monthly restore drill documented | ✓ `ops/runbooks/warehouse-restore.md` |

---

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
