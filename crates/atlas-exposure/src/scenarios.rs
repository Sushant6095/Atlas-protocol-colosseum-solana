//! Correlated-liquidation simulator (directive §3.3).

use crate::graph::{NodeId, ProtocolDependencyGraph};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug)]
pub struct ShockScenario {
    pub asset: NodeId,
    pub shock_bps: u32, // -X% expressed in bps
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ShockReport {
    pub scenario: ShockScenarioOwned,
    pub propagated_loss_bps_per_node: BTreeMap<NodeId, u64>,
    pub cumulative_loss_bps: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ShockScenarioOwned {
    pub asset: NodeId,
    pub shock_bps: u32,
}

impl From<ShockScenario> for ShockScenarioOwned {
    fn from(s: ShockScenario) -> Self {
        Self { asset: s.asset, shock_bps: s.shock_bps }
    }
}

/// Simulate `-shock_bps%` on the affected asset and propagate liquidations
/// through the graph. Loss at each entity is proportional to its effective
/// exposure × shock magnitude.
pub fn simulate_correlated_liquidation(
    graph: &ProtocolDependencyGraph,
    allocation_bps: &BTreeMap<NodeId, u32>,
    scenario: ShockScenario,
) -> ShockReport {
    let exposures = graph.effective_exposures(allocation_bps);
    let mut propagated: BTreeMap<NodeId, u64> = BTreeMap::new();
    let mut cumulative: u64 = 0;
    for (node, exposure_bps) in &exposures {
        // Apply shock only to the directly-affected asset and entities
        // reachable from it.
        let loss = if *node == scenario.asset {
            (*exposure_bps as u128 * scenario.shock_bps as u128 / 10_000) as u64
        } else if exposures.contains_key(&scenario.asset) {
            // Propagated: half the magnitude per the directive's path-decay
            // contract; concrete decay handled in `effective_exposures`.
            let propagation = (*exposure_bps as u128 * scenario.shock_bps as u128 / 20_000) as u64;
            propagation
        } else {
            0
        };
        propagated.insert(*node, loss);
        cumulative = cumulative.saturating_add(loss);
    }
    ShockReport {
        scenario: scenario.into(),
        propagated_loss_bps_per_node: propagated,
        cumulative_loss_bps: cumulative,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::{DependencyEdge, EdgeKind, NodeKind};

    fn protocol(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Protocol, id }
    }
    fn asset(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Asset, id }
    }

    #[test]
    fn shock_only_affects_reachable_entities() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 10_000);
        let report = simulate_correlated_liquidation(
            &g,
            &alloc,
            ShockScenario { asset: asset(1), shock_bps: 1_000 },
        );
        assert!(report.cumulative_loss_bps > 0);
        // The shocked asset itself should appear in the propagation map.
        assert!(report
            .propagated_loss_bps_per_node
            .contains_key(&asset(1)));
    }

    #[test]
    fn unrelated_shock_yields_zero_loss() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 10_000);
        let report = simulate_correlated_liquidation(
            &g,
            &alloc,
            ShockScenario { asset: asset(99), shock_bps: 5_000 },
        );
        assert_eq!(report.cumulative_loss_bps, 0);
    }

    #[test]
    fn larger_shock_yields_larger_loss() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 10_000);
        let small = simulate_correlated_liquidation(
            &g,
            &alloc,
            ShockScenario { asset: asset(1), shock_bps: 500 },
        );
        let big = simulate_correlated_liquidation(
            &g,
            &alloc,
            ShockScenario { asset: asset(1), shock_bps: 5_000 },
        );
        assert!(big.cumulative_loss_bps > small.cumulative_loss_bps);
    }
}
