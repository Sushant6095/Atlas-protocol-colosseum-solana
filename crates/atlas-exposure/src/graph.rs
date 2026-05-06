//! Dependency graph + effective-exposure metric.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

/// Decay factor applied per hop when accumulating effective exposure.
/// Expressed in bps (10_000 = no decay). 7_000 = 30% decay per hop, matching
/// the directive's "path weight decays per hop" guidance.
pub const PATH_DECAY_BPS: u32 = 7_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum NodeKind {
    Protocol,
    Asset,
    Oracle,
    Liquidator,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct NodeId {
    pub kind: NodeKind,
    pub id: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(u8)]
pub enum EdgeKind {
    ProtocolUsesAsset = 0,
    ProtocolUsesOracle = 1,
    ProtocolSharesLiquidator = 2,
    AssetCorrelated = 3,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct DependencyEdge {
    pub from: NodeId,
    pub to: NodeId,
    pub kind: EdgeKind,
    /// 0..=10_000 bps. For `AssetCorrelated`, this is the 30d Pearson
    /// correlation magnitude in bps.
    pub weight_bps: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposureFlag {
    EffectiveOracleConcentration,
    SharedCollateralRisk,
    SharedLiquidatorRisk,
    AssetCorrelationCluster,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EffectiveExposure {
    pub entity: NodeId,
    /// Sum of `a_i × path_weight(protocol_i → entity)` in bps of NAV.
    pub bps: u64,
    pub flags: Vec<ExposureFlag>,
}

/// Revision marker — directive §4 anti-pattern enforcement: *"Computing the
/// dependency graph offline and forgetting to re-run after adding a new
/// protocol."* The orchestrator records the protocol-set hash + slot here;
/// before consuming the graph in a commitment path, it re-asserts equality
/// against the current allocation universe.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphRevision {
    pub protocol_set_hash: [u8; 32],
    pub last_recomputed_slot: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GraphStaleError {
    #[error("graph protocol-set hash drifted")]
    ProtocolSetDrifted,
    #[error("graph not recomputed since slot {graph_slot}, current {current_slot}, max age {max_age}")]
    AgeExceeded { graph_slot: u64, current_slot: u64, max_age: u64 },
}

#[derive(Clone, Debug, Default)]
pub struct ProtocolDependencyGraph {
    edges: Vec<DependencyEdge>,
    /// Adjacency keyed by `from` → `(to, kind, weight)`.
    adj: BTreeMap<NodeId, Vec<(NodeId, EdgeKind, u32)>>,
    revision: Option<GraphRevision>,
}

impl ProtocolDependencyGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_edge(&mut self, edge: DependencyEdge) {
        self.edges.push(edge);
        self.adj
            .entry(edge.from)
            .or_default()
            .push((edge.to, edge.kind, edge.weight_bps));
    }

    pub fn edges(&self) -> &[DependencyEdge] {
        &self.edges
    }

    /// Effective exposure to every reachable entity from a per-protocol
    /// allocation `a` (bps of NAV). Path weight decays by `PATH_DECAY_BPS`
    /// per hop, weighted by the edge weight.
    pub fn effective_exposures(
        &self,
        allocation_bps: &BTreeMap<NodeId, u32>,
    ) -> BTreeMap<NodeId, u64> {
        let mut out: BTreeMap<NodeId, u64> = BTreeMap::new();
        for (protocol, alloc_bps) in allocation_bps.iter() {
            self.bfs_from(*protocol, *alloc_bps as u64, &mut out);
        }
        out
    }

    fn bfs_from(&self, root: NodeId, alloc_bps: u64, out: &mut BTreeMap<NodeId, u64>) {
        // Each queue entry: (node, accumulated_weight_bps)
        let mut queue: VecDeque<(NodeId, u64)> = VecDeque::new();
        let mut visited: BTreeSet<NodeId> = BTreeSet::new();
        queue.push_back((root, alloc_bps));
        while let Some((node, weight)) = queue.pop_front() {
            if !visited.insert(node) {
                continue;
            }
            *out.entry(node).or_insert(0) =
                out.get(&node).copied().unwrap_or(0).saturating_add(weight);
            if let Some(neighbours) = self.adj.get(&node) {
                for (next, _kind, edge_weight_bps) in neighbours {
                    if visited.contains(next) {
                        continue;
                    }
                    // weight_through_edge = weight * edge_weight * decay / 10_000^2
                    let through = (weight as u128)
                        .saturating_mul(*edge_weight_bps as u128)
                        .saturating_mul(PATH_DECAY_BPS as u128)
                        / (10_000u128 * 10_000u128);
                    if through == 0 {
                        continue;
                    }
                    queue.push_back((*next, through.min(u64::MAX as u128) as u64));
                }
            }
        }
    }

    /// Surface common adversarial patterns directly. Returns flags found in
    /// the graph for the given allocation.
    pub fn flags(&self, allocation_bps: &BTreeMap<NodeId, u32>) -> Vec<ExposureFlag> {
        let mut flags = Vec::new();
        // 1. Effective oracle concentration: ≥2 allocated protocols share an oracle.
        let mut oracle_users: BTreeMap<NodeId, BTreeSet<NodeId>> = BTreeMap::new();
        let mut liq_users: BTreeMap<NodeId, BTreeSet<NodeId>> = BTreeMap::new();
        let mut asset_users: BTreeMap<NodeId, BTreeSet<NodeId>> = BTreeMap::new();
        for e in &self.edges {
            if !allocation_bps.contains_key(&e.from) {
                continue;
            }
            match e.kind {
                EdgeKind::ProtocolUsesOracle => {
                    oracle_users.entry(e.to).or_default().insert(e.from);
                }
                EdgeKind::ProtocolSharesLiquidator => {
                    liq_users.entry(e.to).or_default().insert(e.from);
                }
                EdgeKind::ProtocolUsesAsset => {
                    asset_users.entry(e.to).or_default().insert(e.from);
                }
                EdgeKind::AssetCorrelated => {}
            }
        }
        if oracle_users.values().any(|users| users.len() >= 2) {
            flags.push(ExposureFlag::EffectiveOracleConcentration);
        }
        if asset_users.values().any(|users| users.len() >= 2) {
            flags.push(ExposureFlag::SharedCollateralRisk);
        }
        if liq_users.values().any(|users| users.len() >= 2) {
            flags.push(ExposureFlag::SharedLiquidatorRisk);
        }
        // 2. Asset-correlation cluster: any AssetCorrelated edge with weight > 7_000.
        if self
            .edges
            .iter()
            .any(|e| e.kind == EdgeKind::AssetCorrelated && e.weight_bps >= 7_000)
        {
            flags.push(ExposureFlag::AssetCorrelationCluster);
        }
        flags
    }

    pub fn revision(&self) -> Option<GraphRevision> {
        self.revision
    }

    /// Stamp the graph's revision after recomputing for the given protocol
    /// set + slot. Use after add_edge churn whenever the allocation universe
    /// changes.
    pub fn stamp_revision(&mut self, protocol_ids: &[u32], current_slot: u64) {
        let mut sorted: Vec<u32> = protocol_ids.to_vec();
        sorted.sort();
        sorted.dedup();
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.exposure.protocols.v1\x00");
        for id in &sorted {
            h.update(&id.to_le_bytes());
        }
        self.revision = Some(GraphRevision {
            protocol_set_hash: h.finalize().into(),
            last_recomputed_slot: current_slot,
        });
    }

    /// Refuse stale graphs in the commitment path. Caller passes the current
    /// allocation universe + slot. Returns `Err` if the protocol set has
    /// drifted or the graph was not recomputed within `max_age_slots`.
    pub fn assert_current(
        &self,
        current_protocol_ids: &[u32],
        current_slot: u64,
        max_age_slots: u64,
    ) -> Result<(), GraphStaleError> {
        let mut sorted: Vec<u32> = current_protocol_ids.to_vec();
        sorted.sort();
        sorted.dedup();
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.exposure.protocols.v1\x00");
        for id in &sorted {
            h.update(&id.to_le_bytes());
        }
        let current_hash: [u8; 32] = h.finalize().into();
        let revision = self.revision.unwrap_or(GraphRevision {
            protocol_set_hash: [0u8; 32],
            last_recomputed_slot: 0,
        });
        if revision.protocol_set_hash != current_hash {
            return Err(GraphStaleError::ProtocolSetDrifted);
        }
        let age = current_slot.saturating_sub(revision.last_recomputed_slot);
        if age > max_age_slots {
            return Err(GraphStaleError::AgeExceeded {
                graph_slot: revision.last_recomputed_slot,
                current_slot,
                max_age: max_age_slots,
            });
        }
        Ok(())
    }

    /// Domain-tagged hash over sorted edges. Deterministic and feeds
    /// `risk_state_hash` in the public input.
    pub fn topology_hash(&self) -> [u8; 32] {
        let mut sorted = self.edges.clone();
        sorted.sort();
        sorted.dedup();
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.exposure.topology.v1\x00");
        for e in &sorted {
            h.update(&[e.kind as u8]);
            h.update(&[e.from.kind as u8]);
            h.update(&e.from.id.to_le_bytes());
            h.update(&[e.to.kind as u8]);
            h.update(&e.to.id.to_le_bytes());
            h.update(&e.weight_bps.to_le_bytes());
        }
        h.finalize().into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn protocol(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Protocol, id }
    }
    fn oracle(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Oracle, id }
    }
    fn asset(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Asset, id }
    }
    fn liquidator(id: u32) -> NodeId {
        NodeId { kind: NodeKind::Liquidator, id }
    }

    #[test]
    fn topology_hash_is_order_independent() {
        let mut a = ProtocolDependencyGraph::new();
        let mut b = ProtocolDependencyGraph::new();
        for (from, to, k) in [
            (protocol(1), oracle(1), EdgeKind::ProtocolUsesOracle),
            (protocol(2), oracle(1), EdgeKind::ProtocolUsesOracle),
        ] {
            a.add_edge(DependencyEdge { from, to, kind: k, weight_bps: 10_000 });
        }
        for (from, to, k) in [
            (protocol(2), oracle(1), EdgeKind::ProtocolUsesOracle),
            (protocol(1), oracle(1), EdgeKind::ProtocolUsesOracle),
        ] {
            b.add_edge(DependencyEdge { from, to, kind: k, weight_bps: 10_000 });
        }
        assert_eq!(a.topology_hash(), b.topology_hash());
    }

    #[test]
    fn effective_oracle_concentration_flagged() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: oracle(7),
            kind: EdgeKind::ProtocolUsesOracle,
            weight_bps: 10_000,
        });
        g.add_edge(DependencyEdge {
            from: protocol(2),
            to: oracle(7),
            kind: EdgeKind::ProtocolUsesOracle,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 5_000);
        alloc.insert(protocol(2), 5_000);
        let flags = g.flags(&alloc);
        assert!(flags.contains(&ExposureFlag::EffectiveOracleConcentration));
    }

    #[test]
    fn shared_collateral_flagged() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        g.add_edge(DependencyEdge {
            from: protocol(2),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 5_000);
        alloc.insert(protocol(2), 5_000);
        assert!(g.flags(&alloc).contains(&ExposureFlag::SharedCollateralRisk));
    }

    #[test]
    fn shared_liquidator_flagged() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: liquidator(7),
            kind: EdgeKind::ProtocolSharesLiquidator,
            weight_bps: 10_000,
        });
        g.add_edge(DependencyEdge {
            from: protocol(2),
            to: liquidator(7),
            kind: EdgeKind::ProtocolSharesLiquidator,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 5_000);
        alloc.insert(protocol(2), 5_000);
        assert!(g.flags(&alloc).contains(&ExposureFlag::SharedLiquidatorRisk));
    }

    #[test]
    fn isolated_protocol_yields_no_concentration_flags() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: oracle(1),
            kind: EdgeKind::ProtocolUsesOracle,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 10_000);
        let flags = g.flags(&alloc);
        assert!(!flags.contains(&ExposureFlag::EffectiveOracleConcentration));
        assert!(!flags.contains(&ExposureFlag::SharedCollateralRisk));
    }

    #[test]
    fn effective_exposure_decays_per_hop() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: protocol(1),
            to: oracle(1),
            kind: EdgeKind::ProtocolUsesOracle,
            weight_bps: 10_000,
        });
        g.add_edge(DependencyEdge {
            from: oracle(1),
            to: asset(1),
            kind: EdgeKind::ProtocolUsesAsset,
            weight_bps: 10_000,
        });
        let mut alloc = BTreeMap::new();
        alloc.insert(protocol(1), 10_000);
        let exposures = g.effective_exposures(&alloc);
        let direct = exposures.get(&oracle(1)).copied().unwrap_or(0);
        let two_hop = exposures.get(&asset(1)).copied().unwrap_or(0);
        assert!(direct > two_hop);
        // 10_000 * 10_000 * 7_000 / 10_000² = 7_000
        assert_eq!(direct, 7_000);
        // 7_000 * 10_000 * 7_000 / 10_000² = 4_900
        assert_eq!(two_hop, 4_900);
    }

    #[test]
    fn assert_current_passes_when_protocol_set_matches_and_fresh() {
        let mut g = ProtocolDependencyGraph::new();
        g.stamp_revision(&[1, 2, 3], 100);
        g.assert_current(&[3, 2, 1], 110, 1000).unwrap();
    }

    #[test]
    fn assert_current_fails_when_protocol_set_drifted() {
        let mut g = ProtocolDependencyGraph::new();
        g.stamp_revision(&[1, 2, 3], 100);
        let err = g.assert_current(&[1, 2, 4], 110, 1000).unwrap_err();
        assert!(matches!(err, GraphStaleError::ProtocolSetDrifted));
    }

    #[test]
    fn assert_current_fails_when_too_old() {
        let mut g = ProtocolDependencyGraph::new();
        g.stamp_revision(&[1, 2, 3], 100);
        let err = g.assert_current(&[1, 2, 3], 1500, 1000).unwrap_err();
        assert!(matches!(err, GraphStaleError::AgeExceeded { .. }));
    }

    #[test]
    fn unstamped_graph_is_treated_as_drifted() {
        let g = ProtocolDependencyGraph::new();
        let err = g.assert_current(&[1, 2, 3], 100, 1000).unwrap_err();
        assert!(matches!(err, GraphStaleError::ProtocolSetDrifted));
    }

    #[test]
    fn correlation_cluster_flagged_above_7000() {
        let mut g = ProtocolDependencyGraph::new();
        g.add_edge(DependencyEdge {
            from: asset(1),
            to: asset(2),
            kind: EdgeKind::AssetCorrelated,
            weight_bps: 8_500,
        });
        let alloc = BTreeMap::new();
        assert!(g.flags(&alloc).contains(&ExposureFlag::AssetCorrelationCluster));
    }
}
