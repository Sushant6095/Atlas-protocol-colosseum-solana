//! atlas-mev — MEV detection (directive 07 §7).
//!
//! Post-bundle, the keeper inspects the landed block for adjacent
//! transactions touching the same pools and computes a "MEV exposure
//! score". Anomalies emit a `MevAnomaly` event the orchestrator can
//! convert into a forensic signal.
//!
//! Defenses (§7.1) are mostly enforced elsewhere — atomic bundles
//! (atlas-bundle), slippage tighteners (CPI handlers in atlas-rebalancer),
//! private bundle path (Jito), tip oracle (atlas-bundle::tip). This
//! crate is detection-only: it scores observed adjacency and produces
//! the structured anomaly record.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod anomaly;
pub mod exposure;

pub use anomaly::{MevAnomaly, MevAnomalyKind};
pub use exposure::{compute_exposure_score, BlockTx, MevExposureScore};
