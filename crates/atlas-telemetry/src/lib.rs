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
