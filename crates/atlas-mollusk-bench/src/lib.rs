//! atlas-mollusk-bench — Mollusk benchmark harness (directive 07 §12).
//!
//! Mollusk is a Solana SVM testing harness; the on-chain crates run
//! benchmarks under it on every PR. This crate is the **off-chain**
//! ground-truth registry that:
//!
//! 1. Stores baseline CU per `(program, ix)`.
//! 2. Compares observed CU from a Mollusk run against the baseline.
//! 3. Refuses the merge if regression > 5 % on any benchmark.
//!
//! The CI driver (`atlas-bench-check`) reads two JSON files — the
//! committed baseline and the current run — and exits non-zero on any
//! regression breach. Baseline updates are deliberate: a developer
//! amends `bench/baseline.json` in the same PR that lands the
//! optimization, so a regression cannot be hidden by silently moving
//! the baseline.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod baseline;
pub mod report;

pub use baseline::{Baseline, BaselineDb, BaselineDbError};
pub use report::{
    check_regressions, BenchObservation, RegressionDetail, RegressionReport,
    REGRESSION_TOLERANCE_BPS,
};
