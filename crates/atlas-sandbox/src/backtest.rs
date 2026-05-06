//! Backtest engine (directive §1.2).
//!
//! Drives the Phase 01 pipeline in `replay=true` mode against a slot range
//! pulled from the warehouse, threading every feature read through
//! `LeakageProbe`. Output is a `BacktestReport` containing a per-rebalance
//! `BlackBoxRecord` (Phase 05 §3) plus aggregate metrics.
//!
//! The engine owns no I/O it can't replay — historical features come from
//! a `WarehouseClient` (mock or a sandbox-prefixed real backend) and
//! synthetic features come from injection plans. This is the determinism
//! contract from directive §4.

use crate::isolation::{SandboxGuard, SandboxIsolationError};
use crate::leakage::{LeakageProbe, LeakageViolation};
use crate::report::{report_id, AggregateMetrics, RebalanceSimResult};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BacktestConfig {
    pub strategy_hash: [u8; 32],
    pub model_hash: [u8; 32],
    pub vault_template_hash: [u8; 32],
    pub vault_id: [u8; 32],
    pub start_slot: u64,
    pub end_slot: u64,
    /// Sandbox warehouse URI — must pass `SandboxGuard::require_sandbox_uri`.
    pub warehouse_uri: String,
}

#[derive(Debug, thiserror::Error)]
pub enum BacktestError {
    #[error("isolation: {0}")]
    Isolation(#[from] SandboxIsolationError),
    #[error("invalid slot range: start={start} end={end}")]
    InvalidRange { start: u64, end: u64 },
    #[error("leakage detected at rebalance {0}")]
    LeakageDetected(u32),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BacktestReport {
    pub report_id: [u8; 32],
    pub guard: SandboxGuard,
    pub config: BacktestConfig,
    pub rebalances: Vec<RebalanceSimResult>,
    pub aggregate: AggregateMetrics,
    pub leakage_violations: Vec<LeakageViolation>,
}

/// The engine is generic over a `Driver` that produces simulated rebalance
/// results from a slot. Tests inject a deterministic driver; production
/// wires the Phase 01 pipeline behind this trait. Keeping the surface
/// small means the determinism contract is enforced at the trait level.
pub trait BacktestDriver {
    fn simulate(
        &mut self,
        rebalance_index: u32,
        slot: u64,
        probe: &mut LeakageProbe,
    ) -> Option<RebalanceSimResult>;
}

pub struct BacktestEngine<D: BacktestDriver> {
    driver: D,
}

impl<D: BacktestDriver> BacktestEngine<D> {
    pub fn new(driver: D) -> Self {
        Self { driver }
    }

    /// Run the backtest. Performs isolation guard checks first; then drives
    /// the simulator slot-by-slot at the configured rebalance cadence.
    /// Aborts on the first hard leakage violation.
    pub fn run(&mut self, config: BacktestConfig) -> Result<BacktestReport, BacktestError> {
        SandboxGuard::require_sandbox_uri(&config.warehouse_uri)?;
        if config.end_slot <= config.start_slot {
            return Err(BacktestError::InvalidRange {
                start: config.start_slot,
                end: config.end_slot,
            });
        }

        let guard = SandboxGuard {
            sandbox_run_id: report_id(
                &config.strategy_hash,
                &config.model_hash,
                &config.vault_template_hash,
                config.start_slot,
                config.end_slot,
            ),
            replay: true,
        };

        let mut probe = LeakageProbe::new();
        let mut rebalances = Vec::new();
        let mut returns_bps: Vec<i32> = Vec::new();

        // 1-slot cadence is fine for tests; production drives at the strategy
        // cadence. The driver is responsible for skipping non-rebalance slots.
        let mut idx: u32 = 0;
        for slot in config.start_slot..config.end_slot {
            if let Some(r) = self.driver.simulate(idx, slot, &mut probe) {
                if !probe.is_clean() {
                    return Err(BacktestError::LeakageDetected(idx));
                }
                returns_bps.push(r.period_return_bps);
                rebalances.push(r);
                idx += 1;
            }
        }

        let aggregate = AggregateMetrics::from_period_returns(&returns_bps);
        let id = guard.sandbox_run_id;
        Ok(BacktestReport {
            report_id: id,
            guard,
            config,
            rebalances,
            aggregate,
            leakage_violations: probe.violations().to_vec(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_blackbox::{BlackBoxRecord, BlackBoxStatus, Timings, BLACKBOX_SCHEMA};

    fn skel(slot: u64) -> BlackBoxRecord {
        BlackBoxRecord {
            schema: BLACKBOX_SCHEMA.into(),
            vault_id: [1u8; 32],
            slot,
            status: BlackBoxStatus::Landed,
            before_state_hash: [0u8; 32],
            after_state_hash: Some([0u8; 32]),
            balances_before: vec![1_000, 2_000],
            balances_after: Some(vec![1_500, 1_500]),
            feature_root: [0u8; 32],
            consensus_root: [0u8; 32],
            agent_proposals_uri: "sandbox://atlas/proposals".into(),
            explanation_hash: [0u8; 32],
            explanation_canonical_uri: "sandbox://atlas/explanations".into(),
            risk_state_hash: [0u8; 32],
            risk_topology_uri: "sandbox://atlas/topology".into(),
            public_input_hex: "00".repeat(268),
            proof_uri: "sandbox://atlas/proofs".into(),
            cpi_trace: vec![],
            post_conditions: vec![],
            failure_class: None,
            tx_signature: Some(vec![0u8; 64]),
            landed_slot: Some(slot + 1),
            bundle_id: [0u8; 32],
            prover_id: [0u8; 32],
            timings_ms: Timings::default(),
            telemetry_span_id: "sandbox-span".into(),
        }
    }

    struct FakeDriver {
        cadence: u64,
        leak_at: Option<u32>,
    }

    impl BacktestDriver for FakeDriver {
        fn simulate(
            &mut self,
            rebalance_index: u32,
            slot: u64,
            probe: &mut LeakageProbe,
        ) -> Option<RebalanceSimResult> {
            if slot % self.cadence != 0 {
                return None;
            }
            // Each rebalance reads one feature observed at slot - 1 (clean).
            probe.record_feature(rebalance_index, 1, slot, slot.saturating_sub(1));
            // Optionally inject a leakage violation at a chosen rebalance index.
            if Some(rebalance_index) == self.leak_at {
                probe.record_feature(rebalance_index, 2, slot, slot + 1);
            }
            Some(RebalanceSimResult {
                rebalance_index,
                slot,
                blackbox: skel(slot),
                period_return_bps: 100,
            })
        }
    }

    fn cfg() -> BacktestConfig {
        BacktestConfig {
            strategy_hash: [0u8; 32],
            model_hash: [0u8; 32],
            vault_template_hash: [0u8; 32],
            vault_id: [1u8; 32],
            start_slot: 0,
            end_slot: 10,
            warehouse_uri: "sandbox://test".into(),
        }
    }

    #[test]
    fn backtest_runs_clean_returns_aggregate() {
        let driver = FakeDriver { cadence: 2, leak_at: None };
        let mut e = BacktestEngine::new(driver);
        let r = e.run(cfg()).unwrap();
        // Slots 0..10 with cadence 2 → 5 rebalances at 0, 2, 4, 6, 8.
        assert_eq!(r.rebalances.len(), 5);
        assert_eq!(r.aggregate.realized_apy_bps, 500);
        assert!(r.leakage_violations.is_empty());
        assert!(r.guard.replay);
    }

    #[test]
    fn backtest_aborts_on_leakage() {
        let driver = FakeDriver { cadence: 1, leak_at: Some(3) };
        let mut e = BacktestEngine::new(driver);
        let err = e.run(cfg()).unwrap_err();
        assert!(matches!(err, BacktestError::LeakageDetected(3)));
    }

    #[test]
    fn backtest_rejects_production_uri() {
        let driver = FakeDriver { cadence: 1, leak_at: None };
        let mut e = BacktestEngine::new(driver);
        let mut c = cfg();
        c.warehouse_uri = "s3://atlas/proofs/prod".into();
        assert!(matches!(e.run(c), Err(BacktestError::Isolation(_))));
    }

    #[test]
    fn backtest_rejects_inverted_range() {
        let driver = FakeDriver { cadence: 1, leak_at: None };
        let mut e = BacktestEngine::new(driver);
        let mut c = cfg();
        c.start_slot = 100;
        c.end_slot = 50;
        assert!(matches!(e.run(c), Err(BacktestError::InvalidRange { .. })));
    }

    #[test]
    fn backtest_is_deterministic_byte_for_byte() {
        // Directive §4 determinism check: 5 independent runs must produce
        // byte-identical outputs.
        let runs: Vec<Vec<u8>> = (0..5)
            .map(|_| {
                let driver = FakeDriver { cadence: 2, leak_at: None };
                let mut e = BacktestEngine::new(driver);
                let r = e.run(cfg()).unwrap();
                serde_json::to_vec(&r).unwrap()
            })
            .collect();
        for w in runs.windows(2) {
            assert_eq!(w[0], w[1]);
        }
    }
}
