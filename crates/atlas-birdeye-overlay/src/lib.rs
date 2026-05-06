//! atlas-birdeye-overlay — analyst overlay (directive 09 §3).
//!
//! **Hard rule from §0**: Birdeye output is monitoring + enrichment +
//! UX, NEVER a commitment input. This crate exposes
//! `YieldOpportunity`, the rotation heatmap, and a
//! `quality_score_bps` overlay — all of which feed the dashboard and
//! the public `/api/opportunities` endpoint, none of which feed the
//! Poseidon hash chain. The Phase 09 commitment-path lint pins this.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod attribution;
pub mod heatmap;
pub mod opportunity;
pub mod quality;

pub use attribution::{attribution_join, AttributionRow, SignalToRebalance};
pub use heatmap::{build_heatmap, HeatmapCell, RotationHeatmap};
pub use opportunity::{
    rank_opportunities, RationaleClause, StructuredRationale, YieldOpportunity,
};
pub use quality::{compute_quality_score, QualityInputs};
