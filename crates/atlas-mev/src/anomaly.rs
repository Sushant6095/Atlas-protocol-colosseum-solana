//! Structured `MevAnomaly` event the orchestrator can convert to a
//! Phase 05 forensic signal.

use crate::exposure::MevExposureScore;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MevAnomalyKind {
    /// Adjacency window contains adversaries touching our pools.
    AdjacentSandwichSuspected,
    /// Slippage observed post-trade exceeds our committed band — could
    /// be sandwich front-run that our pre-trade snapshot missed.
    PostTradeSlippageExceeded,
    /// Bundle landed but a same-pool transaction in the previous slot
    /// flipped price unfavourably.
    PriorSlotFrontRun,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MevAnomaly {
    pub kind: MevAnomalyKind,
    pub vault_id: [u8; 32],
    pub slot: u64,
    pub bundle_id: [u8; 32],
    pub score: MevExposureScore,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_score() -> MevExposureScore {
        MevExposureScore {
            atlas_position: 10,
            adjacency: 2,
            pool_overlap_bps: 10_000,
            bracket_signature: [7u8; 32],
            score_bps: 30_000,
        }
    }

    #[test]
    fn anomaly_round_trips_serde() {
        let a = MevAnomaly {
            kind: MevAnomalyKind::AdjacentSandwichSuspected,
            vault_id: [1u8; 32],
            slot: 100,
            bundle_id: [2u8; 32],
            score: dummy_score(),
        };
        let s = serde_json::to_string(&a).unwrap();
        let back: MevAnomaly = serde_json::from_str(&s).unwrap();
        assert_eq!(a, back);
    }
}
