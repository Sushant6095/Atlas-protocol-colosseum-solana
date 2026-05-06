//! Atlas telemetry — Prometheus metrics + tracing spans.
//!
//! The metric names below are the **observability contract** in directive §13.
//! Renaming them breaks dashboards and alerts; add new metrics, never repurpose
//! the existing ones. Every span carries `vault_id`, `slot`, `pipeline_run_id`.
//! Replay-mode spans are tagged `replay=true` so production dashboards can
//! exclude them by default.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use once_cell::sync::Lazy;
use prometheus::{
    exponential_buckets, register_counter_vec, register_gauge_vec, CounterVec, Encoder, GaugeVec,
    HistogramVec, Registry, TextEncoder,
};

/// Mandatory label set for every Atlas metric.
const LABELS: &[&str] = &["vault_id", "replay"];
/// Subset used by per-protocol counters.
const LABELS_PROTO: &[&str] = &["vault_id", "protocol", "replay"];

#[derive(Debug, thiserror::Error)]
pub enum TelemetryError {
    #[error("prometheus encoder failed: {0}")]
    Encoder(String),
    #[error("metric registration failed: {0}")]
    Registration(String),
}

/// Global registry. The orchestrator exposes this on `/metrics` via Hyper or
/// any other HTTP server; replay/adversarial tools read it via `gather_text`.
pub static REGISTRY: Lazy<Registry> = Lazy::new(Registry::new);

// ─── Histograms ───────────────────────────────────────────────────────────

pub static REBALANCE_E2E_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_rebalance_e2e_seconds",
        "End-to-end rebalance wall time (snapshot → bundle landed). p99 SLO ≤ 90s.",
        exponential_buckets(0.5, 2.0, 10).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static PROOF_GEN_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_proof_gen_seconds",
        "SP1 proof generation wall time. p99 SLO ≤ 75s.",
        exponential_buckets(1.0, 1.5, 10).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INFERENCE_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_inference_ms",
        "Off-chain inference wall time (ranker only). p99 SLO ≤ 250 ms.",
        exponential_buckets(1.0, 1.5, 12).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INGEST_QUORUM_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_ingest_quorum_ms",
        "RPC quorum read wall time. p99 SLO ≤ 1500 ms.",
        exponential_buckets(50.0, 1.5, 10).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static VERIFIER_CU: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_verifier_cu",
        "Compute units consumed by the on-chain verifier ix. p99 SLO ≤ 280k.",
        vec![100_000.0, 150_000.0, 200_000.0, 250_000.0, 280_000.0, 320_000.0, 400_000.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static REBALANCE_CU_TOTAL: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_rebalance_cu_total",
        "Total CU per rebalance bundle. p99 SLO ≤ 1.2M; hard cap 1.4M.",
        vec![400_000.0, 600_000.0, 800_000.0, 1_000_000.0, 1_200_000.0, 1_400_000.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

// ─── Counters ─────────────────────────────────────────────────────────────

pub static CPI_FAILURE_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_cpi_failure_total",
        "CPI failures observed during a bundle. SLO ≤ 0.5% of rebalances.",
        LABELS_PROTO
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static STALE_PROOF_REJECTIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_stale_proof_rejections_total",
        "Proofs rejected because slot freshness gate failed. Alert on rate > 0.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static ARCHIVAL_FAILURES_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_archival_failures_total",
        "Archival writes that failed. Per I-8, the rebalance is aborted in this case. Alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static QUORUM_DISAGREEMENT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_quorum_disagreement_total",
        "RPC quorum read halted because providers disagreed on an account hash. Alert on rate spike.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Gauges ───────────────────────────────────────────────────────────────

pub static CONSENSUS_DISAGREEMENT_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_consensus_disagreement_bps",
        "Live disagreement metric across the agent ensemble (1 - cosine in bps). Alert > 1500 sustained.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 02 — Data Ingestion Fabric SLOs (directive §8) ────────────────

pub static INGEST_EVENT_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_ingest_event_lag_slots",
        "Slots between leader inclusion and event arrival. p99 SLO ≤ 2.",
        vec![0.0, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0]
    );
    let h = HistogramVec::new(opts, &["source"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INGEST_EVENT_LAG_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_ingest_event_lag_ms",
        "Wall time between leader inclusion and event arrival on gRPC sources. p99 SLO ≤ 600 ms.",
        exponential_buckets(50.0, 1.5, 10).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, &["source"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INGEST_QUORUM_MATCH_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_ingest_quorum_match_rate_bps",
        "Rolling 1h quorum match rate in bps (10_000 = 100%). SLO ≥ 9_950.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INGEST_DEDUP_DROPPED_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ingest_dedup_dropped_total",
        "Events dropped by content-addressed dedup. Alert on rate > 5× 7d median.",
        &["source"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INGEST_BUS_OVERFLOW_COMMITMENT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ingest_bus_overflow_commitment_total",
        "Commitment-channel overflow — fatal per directive §2. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INGEST_SOURCE_QUARANTINED_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ingest_source_quarantined_total",
        "Sources quarantined by the quorum reliability EMA falling below threshold.",
        &["source"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INGEST_REPLAY_DRIFT_EVENTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ingest_replay_drift_events_total",
        "Events whose replay output diverged from the recorded production stream. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 03 — Warehouse SLOs (directive §8) ─────────────────────────────

pub static WAREHOUSE_WRITE_LAG_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_warehouse_write_lag_ms",
        "Wall-time latency of WarehouseClient inserts. p99 SLO ≤ 800 ms.",
        exponential_buckets(50.0, 1.5, 10).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, &["table"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static WAREHOUSE_ARCHIVE_FAILURE_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_warehouse_archive_failure_total",
        "WarehouseClient writes that returned an error. Hard alert on any.",
        &["table"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static WAREHOUSE_BUBBLEGUM_ANCHOR_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_warehouse_bubblegum_anchor_lag_slots",
        "Slots between the latest accepted rebalance receipt and its Bubblegum anchor leaf. p99 SLO ≤ 600.",
        vec![32.0, 64.0, 128.0, 256.0, 512.0, 600.0, 1024.0, 2048.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static WAREHOUSE_REPLAY_QUERY_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_warehouse_replay_query_ms",
        "Wall-time of a replay range query. p99 SLO ≤ 5_000 ms for a 1h range.",
        exponential_buckets(100.0, 1.5, 12).unwrap_or_default()
    );
    let h = HistogramVec::new(opts, &["range_class"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static WAREHOUSE_FEATURE_STORE_LEAKAGE_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_warehouse_feature_store_leakage_violations_total",
        "Feature-store queries that returned data observable AFTER the requested as_of_slot. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 04 — LIE + OVL SLOs (directive §1.6, §2.6) ───────────────────

pub static LIE_SNAPSHOT_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_lie_snapshot_lag_slots",
        "Slots between leader inclusion and LiquidityMetrics emission. p99 SLO ≤ 4.",
        vec![0.0, 1.0, 2.0, 4.0, 8.0, 16.0]
    );
    let h = HistogramVec::new(opts, &["pool"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static LIE_TOXICITY_HIGH_POOL_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_lie_toxicity_high_pool_total",
        "Pools observed above T_TOXIC (6_500 bps) over rolling 1h. Alert on cliff.",
        &["pool"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static LIE_FRAGMENTATION_INDEX_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_lie_fragmentation_index_bps",
        "Per-pair fragmentation index distribution (0..=10_000 bps). Dashboarded p95.",
        vec![0.0, 1_000.0, 2_500.0, 5_000.0, 7_500.0, 9_000.0, 10_000.0]
    );
    let h = HistogramVec::new(opts, &["pair"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static OVL_DEVIATION_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_ovl_deviation_bps",
        "Per-asset max-pairwise oracle deviation in bps. Dashboarded p99.",
        vec![5.0, 10.0, 30.0, 80.0, 200.0, 500.0]
    );
    let h = HistogramVec::new(opts, &["asset"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static OVL_STALE_PYTH_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ovl_stale_pyth_total",
        "Pyth feeds observed stale (current_slot - publish_slot > 25). Alert on rate.",
        &["asset"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static OVL_DEFENSIVE_TRIGGER_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_ovl_defensive_trigger_total",
        "Defensive-mode triggers caused by oracle validation. Alert on rate.",
        &["asset", "reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static OVL_CONSENSUS_CONFIDENCE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_ovl_consensus_confidence_bps",
        "Per-asset consensus confidence (0..=10_000 bps). p10 SLO ≥ 7_000.",
        &["asset"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 05 — Forensic / Failure / Black-Box SLOs (directive 05 §6) ─────

pub static FORENSIC_SIGNAL_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_forensic_signal_lag_slots",
        "Slots between on-chain triggering tx and ForensicSignal emission. p99 SLO ≤ 8.",
        vec![0.0, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0]
    );
    let h = HistogramVec::new(opts, &["kind"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static FAILURE_UNCATEGORIZED_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_failure_uncategorized_total",
        "Pipeline errors that escaped FailureClass coverage. Hard alert on any.",
        &["stage"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static ALERTS_PAGE_PER_DAY: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_alerts_page_per_day",
        "Rolling 24h Page-severity alert count. SLO ≤ 5/day in steady state.",
        &["category"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static BLACKBOX_RECORD_COMPLETENESS_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_blackbox_record_completeness_violations_total",
        "BlackBoxRecord write attempts rejected by validate(). Hard alert on any (anti-pattern §7).",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static CAPITAL_IDLE_SHARE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_capital_idle_share_bps",
        "Idle capital share in bps (0..=10_000). p95 SLO ≤ 2_000 in steady state.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 06 — Sandbox / Registry SLOs (directive 06 §5) ────────────────

pub static SANDBOX_BACKTEST_RUNTIME_MINUTES: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_sandbox_backtest_runtime_minutes",
        "Wall-clock minutes for a single backtest run. 90d range p95 SLO ≤ 30.",
        vec![1.0, 5.0, 10.0, 15.0, 20.0, 30.0, 45.0, 60.0, 120.0]
    );
    let h = HistogramVec::new(opts, &["range_class"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static SANDBOX_LEAKAGE_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_sandbox_leakage_violations_total",
        "Backtests aborted due to point-in-time leakage. Hard alert on any.",
        &["kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static SANDBOX_DETERMINISM_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_sandbox_determinism_violations_total",
        "Sandbox runs that diverged across the 5x reproducibility check. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static REGISTRY_UNAUDITED_IN_PRODUCTION_TOTAL: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_registry_unaudited_in_production_total",
        "Models in production whose registry status is not Approved. Must be 0.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static REGISTRY_DRIFT_FLAGGED_MODELS_TOTAL: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_registry_drift_flagged_models_total",
        "Active count of models in DriftFlagged status. Dashboarded.",
        &["model_family"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 07 — Solana Runtime SLOs (directive 07 §10) ───────────────────

pub static RUNTIME_CU_USED: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_runtime_cu_used",
        "Compute units consumed per rebalance bundle. p99 SLO ≤ 1.2M; hard cap 1.4M.",
        vec![400_000.0, 600_000.0, 800_000.0, 1_000_000.0, 1_200_000.0, 1_400_000.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RUNTIME_CU_PREDICTED_VS_USED_DRIFT_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_runtime_cu_predicted_vs_used_drift_bps",
        "Drift between predicted and used CU per rebalance, in bps. SLO ±1500.",
        vec![100.0, 250.0, 500.0, 1_000.0, 1_500.0, 2_500.0, 5_000.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RUNTIME_TX_SIZE_BYTES: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_runtime_tx_size_bytes",
        "Transaction size per Atlas tx. p99 SLO ≤ 1180 bytes (hard cap 1232).",
        vec![400.0, 600.0, 800.0, 1_000.0, 1_180.0, 1_232.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RUNTIME_BUNDLE_ATOMICITY_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_runtime_bundle_atomicity_violations_total",
        "Bundle atomicity guard tripped. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNTIME_CPI_POST_CONDITION_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_runtime_cpi_post_condition_violations_total",
        "CPI snapshot diff caught an unauthorized account mutation. Hard alert on any.",
        &["pubkey", "violation_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNTIME_ALT_MISSES_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_runtime_alt_misses_total",
        "Bundle accounts not found in any declared ALT. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNTIME_BUNDLE_LANDED_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_runtime_bundle_landed_rate_bps",
        "Rolling 24h bundle landed rate in bps. SLO ≥ 9_500.",
        &["route"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNTIME_WRITABLE_ACCOUNTS_PER_BUNDLE: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_runtime_writable_accounts_per_bundle",
        "Writable account count per bundle. p99 SLO ≤ 64.",
        vec![8.0, 16.0, 32.0, 48.0, 64.0, 96.0, 128.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

// ─── Phase 07 closeout — Receipt tree / Pyth post / Mollusk bench ────────

pub static RECEIPT_TREE_ROOT_AGE_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_receipt_tree_root_age_slots",
        "Slots between vault state root commitment and on-chain anchor leaf. p99 SLO \u{2264} 600.",
        vec![32.0, 64.0, 128.0, 256.0, 512.0, 600.0, 1024.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static PYTH_POST_FIRST_IX_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_pyth_post_first_ix_violations_total",
        "Bundles assembled with Pyth post not at the first non-CB ix slot. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static MOLLUSK_REGRESSION_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_mollusk_regression_bps",
        "Per-(program, ix) CU regression vs baseline in bps. CI fails > 500 (5 %).",
        vec![0.0, 100.0, 250.0, 500.0, 1_000.0, 2_500.0, 5_000.0]
    );
    let h = HistogramVec::new(opts, &["program", "ix"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

// ─── Phase 08 — Chaos engineering SLOs (directive 08 §6) ─────────────────

pub static CHAOS_DEVIATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_chaos_deviations_total",
        "Chaos cases whose observed outcome diverged from expected. Trends to 0 over time.",
        &["scenario"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static CHAOS_MTTD_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_chaos_mttd_seconds",
        "Mean time to detect a chaos-injected fault. p95 SLO \u{2264} 60 s.",
        vec![5.0, 15.0, 30.0, 60.0, 120.0, 300.0]
    );
    let h = HistogramVec::new(opts, &["scenario"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static CHAOS_MTTR_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_chaos_mttr_seconds",
        "Mean time to recover from a chaos-injected fault. p95 SLO \u{2264} 600 s.",
        vec![60.0, 180.0, 300.0, 600.0, 1_200.0, 3_600.0]
    );
    let h = HistogramVec::new(opts, &["scenario"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static CHAOS_RUNBOOK_COVERAGE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_chaos_runbook_coverage_bps",
        "Fraction of failure classes with a tested runbook in bps. SLO = 10_000.",
        &[]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static CHAOS_SHADOW_DRIFT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_chaos_shadow_drift_total",
        "Mainnet-shadow outcomes diverging from production under no-chaos slots. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 09 — Side-track + public API SLOs (directive 09 §10) ──────────

pub static API_READ_LATENCY_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_api_read_latency_ms",
        "Public API read latency. p99 SLO \u{2264} 400 ms.",
        vec![10.0, 25.0, 50.0, 100.0, 200.0, 400.0, 1_000.0]
    );
    let h = HistogramVec::new(opts, &["endpoint"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static API_ERROR_RATE_5M_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_api_error_rate_5m_bps",
        "Rolling 5-minute error rate in bps. SLO \u{2264} 50 (0.5 %).",
        &["endpoint"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static STREAM_NETWORK_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_stream_network_lag_slots",
        "Slots between leader-included tx and network-stream emit. p99 SLO \u{2264} 2.",
        vec![0.0, 1.0, 2.0, 4.0, 8.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static WEBHOOK_DELIVERY_SUCCESS_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_webhook_delivery_success_rate_bps",
        "Rolling 24h webhook delivery success rate in bps. SLO \u{2265} 9_900.",
        &["subscription_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static FEE_ORACLE_DRIFT_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_fee_oracle_recommendation_drift_bps",
        "Predicted vs actually-needed fee drift in bps. p99 SLO \u{2264} 500.",
        vec![50.0, 100.0, 250.0, 500.0, 1_000.0, 2_500.0]
    );
    let h = HistogramVec::new(opts, &["account_set_hash"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static DFLOW_ROUTE_LANDED_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_dflow_route_landed_rate_bps",
        "Rolling 24h DFlow route landed rate in bps. SLO \u{2265} 9_200.",
        &[]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PRESIGN_FAILURE_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_presign_simulation_failure_rate_bps",
        "Pre-sign simulation failure rate in bps on valid inputs. SLO < 100.",
        &["instruction"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 10 — PUSD treasury SLOs (directive 10 §10) ────────────────────

pub static PUSD_PEG_DEVIATION_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_pusd_peg_deviation_bps",
        "PUSD peg deviation in bps over the consensus mid. p99 24h dashboarded; alert > 50.",
        vec![10.0, 25.0, 50.0, 100.0, 250.0, 500.0]
    );
    let h = HistogramVec::new(opts, &["source"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static PUSD_VAULT_IDLE_BUFFER_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_pusd_vault_idle_buffer_bps",
        "Effective idle buffer per PUSD vault in bps. Alert if < 0.8 \u{00d7} policy.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PUSD_INSTANT_WITHDRAW_SUCCESS_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_pusd_instant_withdraw_success_rate_bps",
        "Instant-withdraw success rate under buffer in bps. SLO \u{2265} 9_990.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PUSD_REBALANCE_PROOF_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_pusd_rebalance_proof_lag_slots",
        "Slots between rebalance submission and proof anchor. p99 SLO \u{2264} 150 (matches I-3).",
        vec![32.0, 64.0, 128.0, 150.0, 256.0, 512.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static PUSD_TOKEN2022_EXTENSION_DRIFT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_pusd_token2022_extension_drift_total",
        "PUSD on-chain extension drift detections. Hard alert on any.",
        &["drift_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static TREASURY_POLICY_VIOLATION_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_treasury_policy_violation_attempts_total",
        "Pipeline tried to do something the treasury policy forbade. Hard alert on any.",
        &["entity_id", "violation_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 11 — Dune intelligence SLOs (directive 11 §12) ────────────────

pub static INTEL_WALLET_REPORT_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_intel_wallet_report_ms",
        "Wall-time of /wallet-intelligence report assembly. p99 SLO \u{2264} 2500.",
        vec![100.0, 250.0, 500.0, 1_000.0, 2_500.0, 5_000.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INTEL_DUNE_QUERY_FAILURE_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_intel_dune_query_failure_rate_bps",
        "Rolling 5-minute Dune query failure rate in bps. SLO \u{2264} 100.",
        &["query_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INTEL_SNAPSHOT_PROVENANCE_MISSING_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_intel_snapshot_provenance_missing_total",
        "Renders that displayed a number without a snapshot provenance tag. Hard alert on any.",
        &["surface"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INTEL_COMMITMENT_PATH_DUNE_IMPORTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_intel_commitment_path_dune_imports_total",
        "Dune-source imports detected in commitment-path source files. Hard alert on any (CI should block; this is defense in depth).",
        &["module"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INTEL_CROSS_CHAIN_LAG_BLOCKS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_intel_cross_chain_lag_blocks",
        "Cross-chain treasury mirror lag in source-chain blocks. Dashboarded per chain.",
        vec![1.0, 4.0, 8.0, 16.0, 32.0, 64.0, 128.0]
    );
    let h = HistogramVec::new(opts, &["chain"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

// ─── Phase 12 — Jupiter execution SLOs (directive 12 §10) ────────────────

pub static TRIGGER_GATE_CHECK_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_trigger_gate_check_ms",
        "Wall-time of the gate_check predicate. p99 SLO \u{2264} 200 ms.",
        vec![5.0, 10.0, 25.0, 50.0, 100.0, 200.0, 500.0]
    );
    let h = HistogramVec::new(opts, &["order_type"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static TRIGGER_GATE_REJECT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_trigger_gate_reject_total",
        "Trigger gate rejections by reason. Used to compute gate_reject_correctness_rate.",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static TRIGGER_FIRE_E2E_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_trigger_fire_e2e_seconds",
        "End-to-end trigger firing wall time (gate pass \u{2192} Jupiter fill). p99 SLO \u{2264} 4.",
        vec![0.5, 1.0, 2.0, 4.0, 8.0, 16.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RECURRING_PLAN_UPDATE_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_recurring_plan_update_lag_slots",
        "Slots between regime-shift detection and the recurring-plan update landing. p99 SLO \u{2264} 150.",
        vec![32.0, 64.0, 128.0, 150.0, 256.0, 512.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RECURRING_CADENCE_VIOLATION_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_recurring_cadence_violation_total",
        "Plan parameters out of strategy-commitment bounds. Hard alert on any.",
        &["bound_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static LEND_CPI_FAILURE_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_lend_cpi_failure_rate_bps",
        "Rolling 24h Jupiter Lend CPI failure rate in bps. SLO \u{2264} 50.",
        &[]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static HEDGE_NAKED_SHORT_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_hedge_naked_short_attempts_total",
        "Hedge requests rejected because notional > underlying. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PREDICTIVE_ROUTING_DRIFT_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_predictive_routing_drift_bps",
        "Observed post-trade impact minus forecast median, in bps. Dashboarded.",
        vec![0.0, 25.0, 50.0, 100.0, 250.0, 500.0]
    );
    let h = HistogramVec::new(opts, &["route"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

// ─── Phase 13 — Atlas Treasury OS / Dodo Payments SLOs ───────────────────

pub static PAYMENT_BUFFER_PREWARM_LATENCY_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_payment_buffer_prewarm_latency_slots",
        "Slots from Dodo schedule receipt to buffer-target rebalance landing. p99 SLO \u{2264} 600.",
        vec![32.0, 64.0, 128.0, 256.0, 600.0, 1_024.0]
    );
    let h = HistogramVec::new(opts, &["priority"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static PAYMENT_DEADLINE_MISS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_payment_deadline_miss_total",
        "Payment intents that missed their latest_at_slot. Hard alert on any.",
        &["priority"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PAYMENT_DODO_SIGNATURE_REJECT_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_payment_dodo_signature_reject_total",
        "Dodo webhook payloads rejected before any state change. Bucketed by reason.",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PAYMENT_INTENT_REPLAY_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_payment_intent_replay_total",
        "Dodo intent_id replay attempts caught by IntentDedup. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNWAY_P10_DAYS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_runway_p10_days",
        "Worst-case (10th percentile) days of runway per business treasury.",
        &["treasury_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RUNWAY_TIER_GAUGE: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_runway_tier",
        "Runway constraint tier: 0=Healthy 1=Cautious 2=Constrained 3=Critical.",
        &["treasury_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INVOICE_OPEN_BALANCE_Q64: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_invoice_open_balance_q64",
        "Open + overdue invoice notional in Q64.",
        &["treasury_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PREWARM_CONSTRAINT_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_prewarm_constraint_violations_total",
        "Pre-warm engine emitted AlertConstraintViolation. Hard alert on any.",
        &["treasury_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 13 closeout — settlement / ledger / compliance ────────────────

pub static PAYMENT_PREWARM_MEETS_DEADLINE_RATE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_payment_prewarm_meets_deadline_rate_bps",
        "Rolling 30d rate at which pre-warm completed by latest_at_slot. SLO \u{2265} 9_990.",
        &["treasury_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PAYMENT_ROLE_CAP_VIOLATION_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_payment_role_cap_violation_attempts_total",
        "Settlement attempts where a role tried to authorise above its single-payout cap. Hard alert on any.",
        &["treasury_id", "role"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static SETTLEMENT_PEG_GUARD_DEFER_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_settlement_peg_guard_defer_total",
        "Settlement quotes deferred because a swap leg's peg deviation exceeded \u{03c4}_peg_swap_bps.",
        &["route"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static LEDGER_UNIFIED_JOIN_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_ledger_unified_join_lag_slots",
        "Slots between Dodo receipt arrival and warehouse-side join landing. p99 SLO \u{2264} 600.",
        vec![32.0, 64.0, 128.0, 256.0, 600.0, 1_024.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static INVOICE_AUTO_DEPOSIT_FAILURE_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_invoice_auto_deposit_failure_total",
        "Invoice → vault auto-deposit attempts that failed (after Auto decision). Alert on rate.",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static COMPLIANCE_SANCTIONS_BLOCKED_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_compliance_sanctions_blocked_total",
        "Settlement intents hard-blocked by Dodo's sanctions screening pre-flight.",
        &["region"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 14 — Confidential Treasury Layer SLOs (directive 14 §10) ──────

pub static CONFIDENTIAL_PROOF_SIZE_INCREASE_BPS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_confidential_proof_size_increase_bps",
        "Proof size increase in bps for confidential mode vs v2. SLO \u{2264} 2_500.",
        vec![100.0, 500.0, 1_000.0, 2_500.0, 5_000.0]
    );
    let h = HistogramVec::new(opts, &[]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static CONFIDENTIAL_VERIFIER_CU: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_confidential_verifier_cu",
        "Compute units consumed by the confidential verifier ix. p99 SLO \u{2264} 320k (vs 250k baseline).",
        vec![100_000.0, 200_000.0, 250_000.0, 320_000.0, 400_000.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static CONFIDENTIAL_REBALANCE_E2E_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_confidential_rebalance_e2e_seconds",
        "End-to-end confidential rebalance wall time. p99 SLO \u{2264} 100s (vs 90s baseline).",
        vec![10.0, 30.0, 60.0, 90.0, 100.0, 180.0]
    );
    let h = HistogramVec::new(opts, LABELS).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static DISCLOSURE_UNBLINDING_EVENTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_disclosure_unblinding_events_total",
        "Disclosure events bucketed by role + reason. Dashboarded; alert on rate spike.",
        &["role", "reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static DISCLOSURE_UNAUTHORIZED_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_disclosure_unauthorized_attempts_total",
        "Disclosure attempts that exceeded the policy scope or used a revoked key. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static CONFIDENTIAL_RANGE_PROOF_FAILURES_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_confidential_range_proof_failures_total",
        "Range-proof verification failures on confidential transfers. Hard alert on any.",
        LABELS
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static CONFIDENTIAL_AML_CLEARANCE_FAILURES_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_confidential_aml_clearance_failures_total",
        "Pre-shield AML clearance failures. Payment auto-aborts.",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 15 — Operator-Agent / Keeper Mandate SLOs (directive 15 §9) ───

pub static KEEPER_CROSS_ROLE_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_keeper_cross_role_attempts_total",
        "Cross-role signing attempts rejected by the program (I-18). Hard alert on any.",
        &["presented_role", "action_class"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static KEEPER_MANDATE_ADMIT_FAILURES_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_keeper_mandate_admit_failures_total",
        "Mandate admit() failures bucketed by reason (expired / cap exhausted / scope / etc).",
        &["reason"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static KEEPER_MANDATE_REMAINING_ACTIONS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_keeper_mandate_remaining_actions",
        "Remaining actions on each active keeper mandate. Dashboarded; alert if < 5% before renewal.",
        &["keeper_pubkey", "role"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static KEEPER_MANDATE_REMAINING_NOTIONAL_Q64: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_keeper_mandate_remaining_notional_q64",
        "Remaining notional cap (Q64) on each active keeper mandate.",
        &["keeper_pubkey", "role"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static ATTESTATION_FRESHNESS_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_attestation_freshness_violations_total",
        "Execution attestations rejected because slot lag > MAX_ATTESTATION_STALENESS_SLOTS. Hard alert on any (I-20).",
        &["attestation_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static ATTESTATION_SAME_SIGNER_VIOLATIONS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_attestation_same_signer_violations_total",
        "Attestation submissions where attestation_keeper == action_keeper. I-20 forbids this. Hard alert on any.",
        &["attestation_kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PENDING_QUEUE_DEPTH: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_pending_queue_depth",
        "Awaiting-decision pending bundles per treasury. Dashboarded.",
        &["treasury_id", "priority"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static PENDING_DECISION_LAG_SLOTS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_pending_decision_lag_slots",
        "Slots between bundle enqueue and multisig decision. p99 SLO ≤ 8_000 (Critical) / 40_000 (Normal).",
        vec![100.0, 500.0, 2_000.0, 8_000.0, 20_000.0, 40_000.0]
    );
    let h = HistogramVec::new(opts, &["priority"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static MANDATE_SCOPE_EXPANSION_ATTEMPTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_mandate_scope_expansion_attempts_total",
        "Mandate construction attempts that tried to widen scope past the canonical role bitset (I-21). Hard alert on any.",
        &["role"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Phase 17 — RPC Router / /infra Observatory SLOs (directive 17 §8) ──

pub static RPC_TIER_A_READ_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_rpc_tier_a_read_ms",
        "Hot-path single-source read latency. p99 SLO ≤ 250 ms.",
        vec![5.0, 15.0, 30.0, 60.0, 120.0, 250.0, 500.0]
    );
    let h = HistogramVec::new(opts, &["source", "region"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RPC_TIER_B_READ_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_rpc_tier_b_read_ms",
        "Commitment-bound quorum read latency. p99 SLO ≤ 800 ms.",
        vec![25.0, 75.0, 150.0, 300.0, 500.0, 800.0, 1_500.0]
    );
    let h = HistogramVec::new(opts, &["source", "region"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static RPC_QUORUM_ATTRIBUTION_OUTLIER_SHARE_BPS: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_rpc_quorum_attribution_outlier_share_bps",
        "Per-source outlier share (bps). Tracked per directive §3.3; alert on cliff toward OUTLIER_QUARANTINE_BPS.",
        &["source"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static INFRA_DASHBOARD_RENDER_MS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = prometheus::histogram_opts!(
        "atlas_infra_dashboard_render_ms",
        "/infra page render wall time. p99 SLO ≤ 1500 ms cold, ≤ 600 ms warm.",
        vec![50.0, 150.0, 300.0, 600.0, 1_000.0, 1_500.0, 3_000.0]
    );
    let h = HistogramVec::new(opts, &["panel", "cache"]).expect("static metric def");
    REGISTRY.register(Box::new(h.clone())).expect("register");
    h
});

pub static FRESHNESS_WINDOW_REMAINING_PCT: Lazy<GaugeVec> = Lazy::new(|| {
    let v = register_gauge_vec!(
        "atlas_freshness_window_remaining_pct",
        "Per-vault freshness budget remaining as % (0..=100). p10 SLO ≥ 30 (proof keeper falls behind otherwise).",
        &["vault_id"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static READ_HOT_COMMITMENT_PATH_MISUSE_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_read_hot_commitment_path_misuse_total",
        "Hot-path read attempts from inside a commitment-path crate. Hard alert on any (lint should already block).",
        &["crate"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RPC_QUORUM_DISAGREEMENT_KIND_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_rpc_quorum_disagreement_kind_total",
        "Quorum disagreements bucketed by kind (soft / hard / total).",
        &["kind"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

pub static RPC_TIER_A_HOT_READ_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    let v = register_counter_vec!(
        "atlas_rpc_tier_a_hot_read_total",
        "Hot-path reads served by tier-A sources, bucketed by source. Used to size the latency win on /infra.",
        &["source"]
    )
    .expect("register");
    REGISTRY.register(Box::new(v.clone())).ok();
    v
});

// ─── Span helpers ─────────────────────────────────────────────────────────

/// Wrap any synchronous block in an Atlas pipeline span. Adds the mandatory
/// labels per directive §13. The closure returns the operation's value; the
/// span is recorded with `duration_ms`.
pub fn span<F, T>(stage: &'static str, vault_id_hex: &str, slot: u64, replay: bool, f: F) -> T
where
    F: FnOnce() -> T,
{
    let start = std::time::Instant::now();
    let span = tracing::info_span!(
        "atlas.stage",
        stage = stage,
        vault_id = vault_id_hex,
        slot = slot,
        replay = replay,
    );
    let _enter = span.enter();
    let v = f();
    let dur_ms = start.elapsed().as_millis() as u64;
    tracing::info!(stage = stage, duration_ms = dur_ms, "stage complete");
    v
}

/// Format a 32-byte vault id into a stable lowercase hex string.
pub fn vault_id_hex(vault_id: &[u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for b in vault_id {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

/// Encode the registry to Prometheus text exposition format. Caller serves
/// this on `/metrics`.
pub fn gather_text() -> Result<String, TelemetryError> {
    let mut buffer = Vec::new();
    let encoder = TextEncoder::new();
    let mf = REGISTRY.gather();
    encoder
        .encode(&mf, &mut buffer)
        .map_err(|e| TelemetryError::Encoder(e.to_string()))?;
    String::from_utf8(buffer).map_err(|e| TelemetryError::Encoder(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch_all() {
        // Dereferencing each Lazy registers the metric on first access.
        let _ = REBALANCE_E2E_SECONDS.with_label_values(&["abc", "false"]).observe(0.0);
        let _ = PROOF_GEN_SECONDS.with_label_values(&["abc", "false"]).observe(0.0);
        let _ = INFERENCE_MS.with_label_values(&["abc", "false"]).observe(0.0);
        let _ = INGEST_QUORUM_MS.with_label_values(&["abc", "false"]).observe(0.0);
        let _ = VERIFIER_CU.with_label_values(&["abc", "false"]).observe(250_000.0);
        let _ = REBALANCE_CU_TOTAL.with_label_values(&["abc", "false"]).observe(900_000.0);
        let _ = CPI_FAILURE_TOTAL.with_label_values(&["abc", "kamino", "false"]).inc();
        let _ = STALE_PROOF_REJECTIONS_TOTAL.with_label_values(&["abc", "false"]).inc();
        let _ = ARCHIVAL_FAILURES_TOTAL.with_label_values(&["abc", "false"]).inc();
        let _ = QUORUM_DISAGREEMENT_TOTAL.with_label_values(&["abc", "false"]).inc();
        let _ = CONSENSUS_DISAGREEMENT_BPS.with_label_values(&["abc", "false"]).set(1200.0);
    }

    #[test]
    fn registry_carries_all_directive_metrics() {
        touch_all();
        let text = gather_text().unwrap();
        for needle in [
            "atlas_rebalance_e2e_seconds",
            "atlas_proof_gen_seconds",
            "atlas_inference_ms",
            "atlas_ingest_quorum_ms",
            "atlas_verifier_cu",
            "atlas_rebalance_cu_total",
            "atlas_cpi_failure_total",
            "atlas_consensus_disagreement_bps",
            "atlas_stale_proof_rejections_total",
            "atlas_archival_failures_total",
            "atlas_quorum_disagreement_total",
        ] {
            assert!(text.contains(needle), "missing metric: {needle}");
        }
    }

    #[test]
    fn vault_id_hex_is_lowercase_64() {
        let v = [0xab_u8; 32];
        let s = vault_id_hex(&v);
        assert_eq!(s.len(), 64);
        assert!(s.chars().all(|c| c.is_ascii_hexdigit() && (c.is_ascii_digit() || c.is_ascii_lowercase())));
    }

    #[test]
    fn span_records_value() {
        let v = span("01-ingest-state", "deadbeef", 12345, false, || 7);
        assert_eq!(v, 7);
    }
}
