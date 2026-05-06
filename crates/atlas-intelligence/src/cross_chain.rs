//! Treasury cross-chain mirror with per-leg provenance (directive §4).
//!
//! Every combined NAV figure carries leg-by-leg provenance inline:
//! Solana = proof-anchored at slot N; EVM = Dune snapshot exec_id X
//! at block M. Anti-pattern §13 forbids combined NAVs without
//! provenance; this module makes provenance the only construction
//! path.

use crate::source::{Chain, QuerySnapshot};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NavProvenance {
    /// Atlas warehouse — proof-anchored at the named slot.
    AtlasProofAnchored { slot: u64 },
    /// Dune snapshot — replayable via the snapshot store.
    DuneSnapshot {
        execution_id: String,
        fetched_at_slot: u64,
        block_height: u64,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChainLeg {
    pub chain: Chain,
    pub nav_q64: u128,
    pub provenance: NavProvenance,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CombinedNav {
    pub treasury_entity_id: [u8; 32],
    pub legs: Vec<ChainLeg>,
    pub combined_nav_q64: u128,
    pub generated_at_slot: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CombinedNavError {
    #[error("no legs supplied — combined NAV requires at least one")]
    NoLegs,
    #[error("duplicate chain `{0:?}` — combine the legs upstream")]
    DuplicateChain(Chain),
    #[error("Solana leg requires AtlasProofAnchored provenance, got DuneSnapshot")]
    SolanaWithoutWarehouse,
}

pub fn aggregate_cross_chain_nav(
    treasury_entity_id: [u8; 32],
    legs: Vec<ChainLeg>,
    generated_at_slot: u64,
) -> Result<CombinedNav, CombinedNavError> {
    if legs.is_empty() {
        return Err(CombinedNavError::NoLegs);
    }
    let mut seen = std::collections::BTreeSet::new();
    let mut combined: u128 = 0;
    for l in &legs {
        if !seen.insert(l.chain) {
            return Err(CombinedNavError::DuplicateChain(l.chain));
        }
        if l.chain == Chain::Solana
            && !matches!(l.provenance, NavProvenance::AtlasProofAnchored { .. })
        {
            return Err(CombinedNavError::SolanaWithoutWarehouse);
        }
        combined = combined.saturating_add(l.nav_q64);
    }
    Ok(CombinedNav {
        treasury_entity_id,
        legs,
        combined_nav_q64: combined,
        generated_at_slot,
    })
}

/// Convenience: build a Dune-snapshot leg from a returned
/// `QuerySnapshot` so the caller doesn't have to hand-construct the
/// provenance.
pub fn dune_leg(chain: Chain, nav_q64: u128, snap: &QuerySnapshot, block_height: u64) -> ChainLeg {
    ChainLeg {
        chain,
        nav_q64,
        provenance: NavProvenance::DuneSnapshot {
            execution_id: snap.dune_execution_id.clone(),
            fetched_at_slot: snap.fetched_at_slot,
            block_height,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solana_leg(nav: u128, slot: u64) -> ChainLeg {
        ChainLeg {
            chain: Chain::Solana,
            nav_q64: nav,
            provenance: NavProvenance::AtlasProofAnchored { slot },
        }
    }

    fn evm_leg(chain: Chain, nav: u128) -> ChainLeg {
        ChainLeg {
            chain,
            nav_q64: nav,
            provenance: NavProvenance::DuneSnapshot {
                execution_id: "exec-123".into(),
                fetched_at_slot: 100,
                block_height: 19_000_000,
            },
        }
    }

    #[test]
    fn aggregates_legs_and_carries_provenance() {
        let combined = aggregate_cross_chain_nav(
            [1u8; 32],
            vec![solana_leg(1_000, 200), evm_leg(Chain::Ethereum, 500)],
            210,
        )
        .unwrap();
        assert_eq!(combined.combined_nav_q64, 1_500);
        assert_eq!(combined.legs.len(), 2);
    }

    #[test]
    fn empty_legs_rejects() {
        assert_eq!(
            aggregate_cross_chain_nav([0u8; 32], vec![], 0),
            Err(CombinedNavError::NoLegs)
        );
    }

    #[test]
    fn duplicate_chain_rejects() {
        let r = aggregate_cross_chain_nav(
            [0u8; 32],
            vec![evm_leg(Chain::Ethereum, 100), evm_leg(Chain::Ethereum, 100)],
            0,
        );
        assert!(matches!(r, Err(CombinedNavError::DuplicateChain(Chain::Ethereum))));
    }

    #[test]
    fn solana_must_use_warehouse_provenance() {
        let bad = ChainLeg {
            chain: Chain::Solana,
            nav_q64: 100,
            provenance: NavProvenance::DuneSnapshot {
                execution_id: "x".into(),
                fetched_at_slot: 0,
                block_height: 0,
            },
        };
        assert_eq!(
            aggregate_cross_chain_nav([0u8; 32], vec![bad], 0),
            Err(CombinedNavError::SolanaWithoutWarehouse)
        );
    }
}
