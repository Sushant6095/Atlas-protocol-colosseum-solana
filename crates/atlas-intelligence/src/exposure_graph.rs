//! Wallet → Protocol → Asset exposure graph (directive §5.2).
//!
//! Force-directed graph rendering positions and downstream exposure
//! through the Phase 04 §3 cross-protocol dependency graph. Nodes
//! sized by notional; edges weighted by path-decayed effective
//! exposure. This module exposes the typed shape — the renderer
//! lives in the frontend.

use atlas_failure::class::{AssetId, ProtocolId};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Wallet,
    Protocol,
    Asset,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExposureNode {
    pub id: String,
    pub kind: NodeKind,
    pub label: String,
    pub size_q64: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExposureEdge {
    pub from: String,
    pub to: String,
    /// Effective exposure weight, in Q64.64. Path decay across the
    /// dependency graph is the caller's job; this struct just stores
    /// the result.
    pub effective_exposure_q64: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ExposureGraph {
    pub wallet: Pubkey,
    pub generated_at_slot: u64,
    pub nodes: Vec<ExposureNode>,
    pub edges: Vec<ExposureEdge>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WalletPosition {
    pub protocol: ProtocolId,
    pub asset: AssetId,
    pub size_q64: u128,
    /// Path decay applied through the dependency graph. 10_000 bps
    /// means no decay; 5_000 bps means half-strength downstream.
    pub effective_decay_bps: u32,
}

/// Build the graph from a list of `WalletPosition` rows. Generates
/// one wallet node, one protocol node per distinct protocol, one
/// asset node per distinct asset, and edges wallet→protocol,
/// protocol→asset weighted by `(size × effective_decay_bps)`.
pub fn build_exposure_graph(
    wallet: Pubkey,
    generated_at_slot: u64,
    positions: &[WalletPosition],
    protocol_label: impl Fn(ProtocolId) -> String,
    asset_label: impl Fn(AssetId) -> String,
) -> ExposureGraph {
    let wallet_id = wallet_node_id(&wallet);
    let mut nodes_by_id: BTreeMap<String, ExposureNode> = BTreeMap::new();
    let mut edges: Vec<ExposureEdge> = Vec::new();

    nodes_by_id.insert(
        wallet_id.clone(),
        ExposureNode {
            id: wallet_id.clone(),
            kind: NodeKind::Wallet,
            label: short(&wallet),
            size_q64: positions.iter().map(|p| p.size_q64).sum(),
        },
    );

    for p in positions {
        let proto_id = format!("protocol:{}", p.protocol.0);
        let asset_id = format!("asset:{}", p.asset.0);

        nodes_by_id
            .entry(proto_id.clone())
            .and_modify(|n| n.size_q64 = n.size_q64.saturating_add(p.size_q64))
            .or_insert(ExposureNode {
                id: proto_id.clone(),
                kind: NodeKind::Protocol,
                label: protocol_label(p.protocol),
                size_q64: p.size_q64,
            });

        nodes_by_id
            .entry(asset_id.clone())
            .and_modify(|n| n.size_q64 = n.size_q64.saturating_add(p.size_q64))
            .or_insert(ExposureNode {
                id: asset_id.clone(),
                kind: NodeKind::Asset,
                label: asset_label(p.asset),
                size_q64: p.size_q64,
            });

        let effective = (p.size_q64.saturating_mul(p.effective_decay_bps.min(10_000) as u128))
            / 10_000;
        edges.push(ExposureEdge {
            from: wallet_id.clone(),
            to: proto_id.clone(),
            effective_exposure_q64: effective,
        });
        edges.push(ExposureEdge {
            from: proto_id,
            to: asset_id,
            effective_exposure_q64: effective,
        });
    }

    ExposureGraph {
        wallet,
        generated_at_slot,
        nodes: nodes_by_id.into_values().collect(),
        edges,
    }
}

fn wallet_node_id(w: &Pubkey) -> String {
    format!("wallet:{}", short(w))
}

fn short(w: &Pubkey) -> String {
    let mut s = String::with_capacity(64);
    for c in w {
        s.push_str(&format!("{:02x}", c));
    }
    s.chars().take(8).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_wallet_protocol_asset_skeleton() {
        let positions = vec![
            WalletPosition {
                protocol: ProtocolId(1),
                asset: AssetId(101),
                size_q64: 1_000,
                effective_decay_bps: 10_000,
            },
            WalletPosition {
                protocol: ProtocolId(2),
                asset: AssetId(101),
                size_q64: 500,
                effective_decay_bps: 5_000,
            },
        ];
        let g = build_exposure_graph(
            [1u8; 32],
            100,
            &positions,
            |p| format!("p{}", p.0),
            |a| format!("a{}", a.0),
        );
        // 1 wallet + 2 protocols + 1 asset = 4 nodes.
        assert_eq!(g.nodes.len(), 4);
        // 2 wallet→protocol + 2 protocol→asset = 4 edges.
        assert_eq!(g.edges.len(), 4);
    }

    #[test]
    fn decay_reduces_effective_exposure() {
        let positions = vec![WalletPosition {
            protocol: ProtocolId(1),
            asset: AssetId(101),
            size_q64: 1_000,
            effective_decay_bps: 5_000, // half-strength
        }];
        let g = build_exposure_graph(
            [1u8; 32],
            100,
            &positions,
            |p| format!("p{}", p.0),
            |a| format!("a{}", a.0),
        );
        let edge = g.edges.iter().find(|e| e.from.starts_with("wallet:")).unwrap();
        assert_eq!(edge.effective_exposure_q64, 500);
    }

    #[test]
    fn empty_positions_only_emit_wallet_node() {
        let g = build_exposure_graph(
            [1u8; 32],
            100,
            &[],
            |p| format!("p{}", p.0),
            |a| format!("a{}", a.0),
        );
        assert_eq!(g.nodes.len(), 1);
        assert_eq!(g.edges.len(), 0);
    }
}
