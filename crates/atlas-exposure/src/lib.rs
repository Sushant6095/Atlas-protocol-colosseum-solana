//! atlas-exposure — Cross-Protocol Exposure Engine.
//!
//! Implements directive 04 §3. Builds a typed dependency graph linking
//! protocols → assets / oracles / liquidators / correlated assets, and
//! computes effective exposures + correlated-liquidation losses for any
//! allocation. Output `topology_hash` is consumed by Phase 01 §8 risk gate
//! and lands in `public_input.risk_state_hash`.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod graph;
pub mod scenarios;

pub use graph::{
    DependencyEdge, EdgeKind, EffectiveExposure, ExposureFlag, NodeId, ProtocolDependencyGraph,
    PATH_DECAY_BPS,
};
pub use scenarios::{ShockScenario, ShockReport, simulate_correlated_liquidation};
