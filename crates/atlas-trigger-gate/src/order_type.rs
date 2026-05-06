//! Five trigger order types (directive §3.5).

use crate::conditions::AtlasCondition;
use atlas_failure::class::ProtocolId;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[repr(u8)]
pub enum TriggerOrderType {
    StopLoss = 1,
    TakeProfit = 2,
    OcoBracket = 3,
    RegimeExit = 4,
    LpExitOnDepthCollapse = 5,
}

pub const TRIGGER_ORDER_TYPES: &[TriggerOrderType] = &[
    TriggerOrderType::StopLoss,
    TriggerOrderType::TakeProfit,
    TriggerOrderType::OcoBracket,
    TriggerOrderType::RegimeExit,
    TriggerOrderType::LpExitOnDepthCollapse,
];

impl TriggerOrderType {
    /// Default condition set the order type ships with. Strategy
    /// commitments may extend with additional clauses but cannot drop
    /// the defaults.
    pub fn default_conditions(self, mint: Pubkey, pool: Pubkey, protocol: ProtocolId) -> Vec<AtlasCondition> {
        match self {
            TriggerOrderType::StopLoss => vec![
                AtlasCondition::PegDeviationBelow { mint, threshold_bps: 50 },
                AtlasCondition::RegimeNotCrisisAndOracleFresh,
            ],
            TriggerOrderType::TakeProfit => vec![
                AtlasCondition::RegimeNotCrisisAndOracleFresh,
            ],
            TriggerOrderType::OcoBracket => vec![
                AtlasCondition::RegimeNotCrisisAndOracleFresh,
                AtlasCondition::VaultDefensiveModeFalse,
            ],
            TriggerOrderType::RegimeExit => vec![
                // Inverted: the trigger fires WHEN the predicate
                // becomes false. Encoded by placing the predicate in
                // the gate's "must-be-false" set at gate-check time;
                // here we simply declare which condition the trigger
                // tracks.
                AtlasCondition::RegimeNotCrisisAndOracleFresh,
            ],
            TriggerOrderType::LpExitOnDepthCollapse => vec![
                AtlasCondition::LpDepthAbove { pool, depth_q64: 1 << 60 },
                AtlasCondition::ProtocolUtilizationBelow { protocol_id: protocol, threshold_bps: 9_500 },
            ],
        }
    }

    pub const fn tag(self) -> u8 {
        self as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn five_order_types_pinned() {
        assert_eq!(TRIGGER_ORDER_TYPES.len(), 5);
    }

    #[test]
    fn tags_are_unique_and_stable() {
        let mut tags: Vec<u8> = TRIGGER_ORDER_TYPES.iter().map(|t| t.tag()).collect();
        let total = tags.len();
        tags.sort();
        tags.dedup();
        assert_eq!(tags.len(), total);
        // Stable byte mapping (StopLoss=1, ...).
        assert_eq!(TriggerOrderType::StopLoss.tag(), 1);
        assert_eq!(TriggerOrderType::LpExitOnDepthCollapse.tag(), 5);
    }

    #[test]
    fn stop_loss_default_includes_peg_deviation_and_oracle_fresh() {
        let cs = TriggerOrderType::StopLoss
            .default_conditions([1u8; 32], [2u8; 32], ProtocolId(1));
        assert!(cs
            .iter()
            .any(|c| matches!(c, AtlasCondition::PegDeviationBelow { .. })));
        assert!(cs.iter().any(|c| *c == AtlasCondition::RegimeNotCrisisAndOracleFresh));
    }

    #[test]
    fn lp_exit_default_tracks_depth_and_utilization() {
        let cs = TriggerOrderType::LpExitOnDepthCollapse
            .default_conditions([1u8; 32], [2u8; 32], ProtocolId(1));
        assert!(cs.iter().any(|c| matches!(c, AtlasCondition::LpDepthAbove { .. })));
        assert!(cs.iter().any(|c| matches!(c, AtlasCondition::ProtocolUtilizationBelow { .. })));
    }
}
