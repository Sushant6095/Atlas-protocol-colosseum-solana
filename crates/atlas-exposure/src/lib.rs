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
    DependencyEdge, EdgeKind, EffectiveExposure, ExposureFlag, GraphRevision, GraphStaleError,
    NodeId, NodeKind, ProtocolDependencyGraph, PATH_DECAY_BPS,
};
pub use scenarios::{ShockScenario, ShockReport, simulate_correlated_liquidation};

/// Combine the Phase 01 pipeline-side `RiskTopology::risk_state_hash` with the
/// cross-protocol exposure topology hash from `ProtocolDependencyGraph::topology_hash`.
/// This is the value that lands in `public_input.risk_state_hash`.
///
/// Domain-tagged so the combined hash cannot collide with either component
/// hash on its own.
pub fn combined_risk_state_hash(
    pipeline_risk_hash: [u8; 32],
    exposure_topology_hash: [u8; 32],
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.risk.combined.v1\x00");
    h.update(&pipeline_risk_hash);
    h.update(&exposure_topology_hash);
    h.finalize().into()
}

#[cfg(test)]
mod combined_tests {
    use super::*;

    #[test]
    fn combined_hash_changes_on_either_component() {
        let p = [1u8; 32];
        let e = [2u8; 32];
        let baseline = combined_risk_state_hash(p, e);
        assert_ne!(baseline, combined_risk_state_hash([3u8; 32], e));
        assert_ne!(baseline, combined_risk_state_hash(p, [4u8; 32]));
    }

    #[test]
    fn combined_hash_deterministic() {
        let a = combined_risk_state_hash([7u8; 32], [9u8; 32]);
        let b = combined_risk_state_hash([7u8; 32], [9u8; 32]);
        assert_eq!(a, b);
    }
}
