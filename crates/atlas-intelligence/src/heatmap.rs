//! Capital flow heatmap (directive §5.1).
//!
//! 24h rolling matrix `(asset × protocol × direction)` with cells
//! sized by notional and coloured by net flow. Source per cell is
//! tagged so the click-through can route to the correct backend.

use atlas_failure::class::{AssetId, ProtocolId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlowDirection {
    In,
    Out,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HeatmapSourceTag {
    /// Source: Atlas warehouse (deterministic, proof-anchored).
    AtlasWarehouse,
    /// Source: Dune snapshot.
    DuneSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FlowCell {
    pub asset: AssetId,
    pub protocol: ProtocolId,
    pub direction: FlowDirection,
    pub notional_q64: u128,
    pub source: HeatmapSourceTag,
    /// Snapshot id when source = `DuneSnapshot`; empty for warehouse.
    pub snapshot_id_hex: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct CapitalFlowHeatmap {
    pub started_at_slot: u64,
    pub ended_at_slot: u64,
    pub cells: Vec<FlowCell>,
}

impl CapitalFlowHeatmap {
    pub fn net_for(&self, asset: AssetId, protocol: ProtocolId) -> i128 {
        let mut net: i128 = 0;
        for c in &self.cells {
            if c.asset == asset && c.protocol == protocol {
                let v = c.notional_q64 as i128;
                match c.direction {
                    FlowDirection::In => net = net.saturating_add(v),
                    FlowDirection::Out => net = net.saturating_sub(v),
                }
            }
        }
        net
    }
}

/// Build a heatmap from raw flow rows. The router decides per cell
/// which source tag to attach: warehouse for protocols Atlas indexes,
/// Dune snapshot for everything else. Routing is the caller's job;
/// this function takes pre-tagged rows.
pub fn build_capital_flow_heatmap(
    started_at_slot: u64,
    ended_at_slot: u64,
    rows: Vec<FlowCell>,
) -> CapitalFlowHeatmap {
    // Aggregate duplicates: same (asset, protocol, direction, source).
    let mut by_key: BTreeMap<(AssetId, ProtocolId, FlowDirection, HeatmapSourceTag), FlowCell> =
        BTreeMap::new();
    for r in rows {
        let key = (r.asset, r.protocol, r.direction, r.source);
        by_key
            .entry(key)
            .and_modify(|c| c.notional_q64 = c.notional_q64.saturating_add(r.notional_q64))
            .or_insert(r);
    }
    CapitalFlowHeatmap {
        started_at_slot,
        ended_at_slot,
        cells: by_key.into_values().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cell(
        asset: u32,
        protocol: u8,
        dir: FlowDirection,
        notional: u128,
        src: HeatmapSourceTag,
    ) -> FlowCell {
        FlowCell {
            asset: AssetId(asset),
            protocol: ProtocolId(protocol),
            direction: dir,
            notional_q64: notional,
            source: src,
            snapshot_id_hex: String::new(),
        }
    }

    #[test]
    fn aggregates_duplicate_cells() {
        let rows = vec![
            cell(1, 1, FlowDirection::In, 100, HeatmapSourceTag::AtlasWarehouse),
            cell(1, 1, FlowDirection::In, 50, HeatmapSourceTag::AtlasWarehouse),
            cell(1, 1, FlowDirection::Out, 30, HeatmapSourceTag::AtlasWarehouse),
        ];
        let h = build_capital_flow_heatmap(0, 100, rows);
        assert_eq!(h.cells.len(), 2); // (in, 150) and (out, 30)
        assert_eq!(h.net_for(AssetId(1), ProtocolId(1)), 120);
    }

    #[test]
    fn warehouse_and_dune_keep_separate_cells() {
        let rows = vec![
            cell(1, 1, FlowDirection::In, 100, HeatmapSourceTag::AtlasWarehouse),
            cell(1, 1, FlowDirection::In, 100, HeatmapSourceTag::DuneSnapshot),
        ];
        let h = build_capital_flow_heatmap(0, 100, rows);
        assert_eq!(h.cells.len(), 2);
    }

    #[test]
    fn net_zero_when_in_equals_out() {
        let rows = vec![
            cell(1, 1, FlowDirection::In, 100, HeatmapSourceTag::DuneSnapshot),
            cell(1, 1, FlowDirection::Out, 100, HeatmapSourceTag::DuneSnapshot),
        ];
        let h = build_capital_flow_heatmap(0, 100, rows);
        assert_eq!(h.net_for(AssetId(1), ProtocolId(1)), 0);
    }
}
