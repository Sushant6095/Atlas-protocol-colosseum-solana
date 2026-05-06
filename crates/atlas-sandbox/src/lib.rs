//! atlas-sandbox — strategy sandbox (directive 06 §1).
//!
//! Isolated dry-run for new strategies and models against historical and
//! synthetic markets. Three contracts:
//!
//! 1. **Isolation** — sandbox runs the Phase 01 pipeline in `replay=true`
//!    only, never touches mainnet keys, and writes to a sandbox database
//!    with the production schema (so reports are diff-able).
//! 2. **Point-in-time** — every feature read carries an `as_of_slot`, and
//!    any returned `observed_at_slot > as_of_slot` is a `LeakageViolation`.
//! 3. **Determinism** — same `(strategy, model, vault_template, slot_range)`
//!    inputs MUST produce byte-identical reports across 5 runs (directive §4).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod backtest;
pub mod compare;
pub mod isolation;
pub mod leakage;
pub mod report;
pub mod whatif;

pub use backtest::{BacktestConfig, BacktestEngine, BacktestError, BacktestReport};
pub use compare::{paired_bootstrap_ci, ComparisonReport, MetricDelta};
pub use isolation::{SandboxGuard, SandboxIsolationError};
pub use leakage::{LeakageProbe, LeakageViolation};
pub use report::{report_id, AggregateMetrics, RebalanceSimResult};
pub use whatif::{Override, ScenarioInjection, WhatIfPlan};
