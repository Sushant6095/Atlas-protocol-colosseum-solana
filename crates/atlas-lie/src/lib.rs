//! atlas-lie — Liquidity Intelligence Engine.
//!
//! Implements directive 04 §1. Produces typed `LiquidityMetrics` per pool
//! per slot. Deterministic over warehouse-pinned inputs (no live network in
//! the commitment path).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod metrics;
pub mod toxicity;
pub mod fragmentation;
pub mod depth;
pub mod source;

pub use metrics::{LiquidityMetrics, ProtocolId, SlippagePoint, snapshot_hash};
pub use toxicity::{
    ToxicityScorer, ToxicityWindow, ToxicitySignals, T_TOXIC_BPS, T_TOXIC_WARN_BPS,
};
pub use fragmentation::{fragmentation_index_bps, RouteShare};
pub use depth::SlippageCurveBuilder;
pub use source::{
    require_pinned, LiveBirdeyeDepth, LiveJupiterQuote, WarehousePinnedSource,
    WarehouseSnapshotRef,
};
