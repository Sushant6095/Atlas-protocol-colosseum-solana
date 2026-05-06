//! atlas-monitor — drift monitor → alert engine bridge (directive 06 §2.4 + §5).
//!
//! Production drift surveillance loop:
//!
//! 1. The orchestrator feeds (predicted, realised) APY pairs, defensive
//!    trigger counts, and Brier-score inputs to the monitor on a rolling
//!    window basis.
//! 2. The monitor calls `atlas_registry::evaluate_drift` to produce a
//!    `DriftReport`.
//! 3. Each `DriftAlert` flagged in the report is mapped to a concrete
//!    `atlas_alert::Alert` via [`drift_alert_to_alert`] and sent through
//!    the `AlertEngine` — the engine's 60-s dedup ensures we don't flood
//!    governance even if drift persists across multiple windows.
//! 4. After K=8 clear evaluations the engine auto-resolves and the
//!    registry's `DriftFlagged` row can be transitioned back to
//!    `Approved` by governance.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod bridge;

pub use bridge::{drift_alert_to_alert, DriftMonitor, MonitorWindow};
