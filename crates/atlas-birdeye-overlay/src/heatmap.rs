//! 24h smart-money rotation heatmap (directive §3.3).

use atlas_failure::class::{AssetId, ProtocolId};
use atlas_forensic::ForensicSignal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Bridge atlas_forensic::ProtocolId → atlas_failure::ProtocolId.
fn bridge(p: atlas_forensic::ProtocolId) -> ProtocolId {
    ProtocolId(p.0)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct HeatmapCell {
    pub asset: AssetId,
    pub protocol: ProtocolId,
    pub net_flow_q64: i128,
    pub wallet_count: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RotationHeatmap {
    pub started_at_slot: u64,
    pub ended_at_slot: u64,
    pub cells: Vec<HeatmapCell>,
}

/// Aggregate `SmartMoneyMigration` signals over a slot window into a
/// heatmap. Signals outside the window are ignored. The heatmap is
/// **not** a commitment input — it surfaces on the dashboard and the
/// `/api/opportunities` rotation widget.
pub fn build_heatmap(
    signals: &[ForensicSignal],
    started_at_slot: u64,
    ended_at_slot: u64,
    asset_for_protocol: impl Fn(ProtocolId) -> AssetId,
) -> RotationHeatmap {
    let mut by_cell: BTreeMap<(AssetId, ProtocolId), HeatmapCell> = BTreeMap::new();
    for s in signals {
        if let ForensicSignal::SmartMoneyMigration {
            from,
            to,
            wallets,
            notional_q64,
            slot,
        } = s
        {
            if *slot < started_at_slot || *slot >= ended_at_slot {
                continue;
            }
            let from_p = bridge(*from);
            let to_p = bridge(*to);
            let from_asset = asset_for_protocol(from_p);
            let to_asset = asset_for_protocol(to_p);
            let from_key = (from_asset, from_p);
            let to_key = (to_asset, to_p);
            let entry = by_cell.entry(from_key).or_insert(HeatmapCell {
                asset: from_asset,
                protocol: from_p,
                net_flow_q64: 0,
                wallet_count: 0,
            });
            entry.net_flow_q64 = entry.net_flow_q64.saturating_sub(*notional_q64 as i128);
            entry.wallet_count = entry.wallet_count.saturating_add(wallets.len() as u32);
            let entry = by_cell.entry(to_key).or_insert(HeatmapCell {
                asset: to_asset,
                protocol: to_p,
                net_flow_q64: 0,
                wallet_count: 0,
            });
            entry.net_flow_q64 = entry.net_flow_q64.saturating_add(*notional_q64 as i128);
            entry.wallet_count = entry.wallet_count.saturating_add(wallets.len() as u32);
        }
    }
    RotationHeatmap {
        started_at_slot,
        ended_at_slot,
        cells: by_cell.into_values().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_forensic::{ProtocolId as PfProto, Pubkey};

    fn smart_migration(from: u8, to: u8, wallets: u32, notional: u128, slot: u64) -> ForensicSignal {
        let w: Vec<Pubkey> = (0..wallets).map(|i| [i as u8; 32]).collect();
        ForensicSignal::SmartMoneyMigration {
            from: PfProto(from),
            to: PfProto(to),
            wallets: w,
            notional_q64: notional,
            slot,
        }
    }

    #[test]
    fn heatmap_aggregates_in_window() {
        let signals = vec![
            smart_migration(1, 2, 3, 1_000, 100),
            smart_migration(2, 3, 1, 500, 110),
            smart_migration(1, 2, 2, 800, 50), // outside window
        ];
        let h = build_heatmap(&signals, 100, 200, |p| AssetId(p.0 as u32));
        // Signals 1→2 + 2→3 share protocol 2 as a cell → 3 unique cells.
        assert_eq!(h.cells.len(), 3);
        // Protocol 2 sees both an outflow (from 2→3) and an inflow (from 1→2).
        let cell2 = h.cells.iter().find(|c| c.protocol == ProtocolId(2)).unwrap();
        assert_eq!(cell2.wallet_count, 4); // 3 from first signal + 1 from second
    }

    #[test]
    fn from_protocol_shows_outflow_to_protocol_shows_inflow() {
        let signals = vec![smart_migration(1, 2, 3, 1_000, 100)];
        let h = build_heatmap(&signals, 0, 200, |p| AssetId(p.0 as u32));
        let from_cell = h.cells.iter().find(|c| c.protocol == ProtocolId(1)).unwrap();
        let to_cell = h.cells.iter().find(|c| c.protocol == ProtocolId(2)).unwrap();
        assert!(from_cell.net_flow_q64 < 0);
        assert!(to_cell.net_flow_q64 > 0);
    }
}
