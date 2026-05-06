//! Jupiter Lend integration shapes (directive §5).
//!
//! Jupiter Lend joins Atlas's allocation universe as a first-class
//! venue. Risk topology gets shared collateral + oracle-dependency
//! edges between Jupiter Lend, Kamino, and Marginfi (Phase 04 §3).

use atlas_failure::class::ProtocolId;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LendVenue {
    pub protocol_id: ProtocolId,
    /// Reserve / market account this position lives in.
    pub reserve: Pubkey,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LendPosition {
    pub venue: LendVenue,
    pub collateral_q64: u128,
    pub borrow_q64: u128,
    /// Health factor in bps. 10_000 = perfectly healthy; below the
    /// venue's MM threshold means liquidation is imminent.
    pub health_bps: u32,
}

impl LendPosition {
    /// True iff `borrow_q64 > 0`. Atlas's allocation engine tracks
    /// borrow utilization separately so the dependency graph can
    /// route around shared collateral correctly.
    pub fn is_borrow_open(&self) -> bool {
        self.borrow_q64 > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn borrow_zero_means_no_open_borrow() {
        let p = LendPosition {
            venue: LendVenue { protocol_id: ProtocolId(4), reserve: [1u8; 32] },
            collateral_q64: 1_000,
            borrow_q64: 0,
            health_bps: 10_000,
        };
        assert!(!p.is_borrow_open());
    }

    #[test]
    fn nonzero_borrow_flagged() {
        let p = LendPosition {
            venue: LendVenue { protocol_id: ProtocolId(4), reserve: [1u8; 32] },
            collateral_q64: 1_000,
            borrow_q64: 100,
            health_bps: 7_000,
        };
        assert!(p.is_borrow_open());
    }
}
