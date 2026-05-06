//! `AtlasCondition` enum + canonical layout (directive §3.3).
//!
//! Each variant is a fixed byte layout under the versioned domain
//! tag `b"atlas.cond.v1"`. The conditions hash enters the trigger's
//! commitment and is byte-equality checked at gate time — not field
//! by field.

use atlas_failure::class::{AssetId, FeedId, ProtocolId};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

pub const CONDITIONS_DOMAIN_TAG: &[u8] = b"atlas.cond.v1";

/// Five canonical condition predicates the verifier can evaluate from
/// on-chain accounts + validated oracles. Anti-pattern §11 forbids
/// off-chain Birdeye / Dune state in conditions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum AtlasCondition {
    /// Regime is not `Crisis` AND oracle is fresh.
    RegimeNotCrisisAndOracleFresh,
    /// Protocol utilization below `threshold_bps`.
    ProtocolUtilizationBelow { protocol_id: ProtocolId, threshold_bps: u32 },
    /// Mint peg deviation below `threshold_bps`.
    PegDeviationBelow { mint: Pubkey, threshold_bps: u32 },
    /// LP depth above `depth_q64` for the named pool.
    LpDepthAbove { pool: Pubkey, depth_q64: u128 },
    /// Vault not currently in defensive mode.
    VaultDefensiveModeFalse,
    /// Composite of feed freshness for a list of feeds.
    AllFeedsFresh { feeds: Vec<FeedId> },
    /// Composite of asset peg health.
    AssetPegHealthy { asset: AssetId, threshold_bps: u32 },
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AtlasConditions {
    pub clauses: Vec<AtlasCondition>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ConditionsError {
    #[error("conditions list must contain at least one clause")]
    Empty,
    #[error("conditions hash mismatch: claimed={claimed:?}, computed={computed:?}")]
    HashMismatch { claimed: [u8; 32], computed: [u8; 32] },
}

impl AtlasConditions {
    pub fn new(clauses: Vec<AtlasCondition>) -> Result<Self, ConditionsError> {
        if clauses.is_empty() {
            return Err(ConditionsError::Empty);
        }
        Ok(Self { clauses })
    }

    pub fn hash(&self) -> [u8; 32] {
        conditions_hash(&self.clauses)
    }
}

/// `conditions_hash = blake3("atlas.cond.v1" || canonical_bytes)`.
/// Deterministic over clause order — the verifier and the keeper
/// must produce the same bytes.
pub fn conditions_hash(clauses: &[AtlasCondition]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(CONDITIONS_DOMAIN_TAG);
    h.update(&(clauses.len() as u32).to_le_bytes());
    for c in clauses {
        match c {
            AtlasCondition::RegimeNotCrisisAndOracleFresh => {
                h.update(&[1u8]);
            }
            AtlasCondition::ProtocolUtilizationBelow { protocol_id, threshold_bps } => {
                h.update(&[2u8]);
                h.update(&[protocol_id.0]);
                h.update(&threshold_bps.to_le_bytes());
            }
            AtlasCondition::PegDeviationBelow { mint, threshold_bps } => {
                h.update(&[3u8]);
                h.update(mint);
                h.update(&threshold_bps.to_le_bytes());
            }
            AtlasCondition::LpDepthAbove { pool, depth_q64 } => {
                h.update(&[4u8]);
                h.update(pool);
                h.update(&depth_q64.to_le_bytes());
            }
            AtlasCondition::VaultDefensiveModeFalse => {
                h.update(&[5u8]);
            }
            AtlasCondition::AllFeedsFresh { feeds } => {
                h.update(&[6u8]);
                h.update(&(feeds.len() as u32).to_le_bytes());
                for f in feeds {
                    h.update(&f.0.to_le_bytes());
                }
            }
            AtlasCondition::AssetPegHealthy { asset, threshold_bps } => {
                h.update(&[7u8]);
                h.update(&asset.0.to_le_bytes());
                h.update(&threshold_bps.to_le_bytes());
            }
        }
    }
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_clauses_rejects() {
        assert_eq!(AtlasConditions::new(vec![]), Err(ConditionsError::Empty));
    }

    #[test]
    fn hash_is_deterministic() {
        let a = vec![AtlasCondition::RegimeNotCrisisAndOracleFresh];
        let h1 = conditions_hash(&a);
        let h2 = conditions_hash(&a);
        assert_eq!(h1, h2);
    }

    #[test]
    fn hash_changes_with_clause_set() {
        let a = vec![AtlasCondition::RegimeNotCrisisAndOracleFresh];
        let b = vec![AtlasCondition::VaultDefensiveModeFalse];
        assert_ne!(conditions_hash(&a), conditions_hash(&b));
    }

    #[test]
    fn hash_changes_with_clause_parameters() {
        let a = vec![AtlasCondition::PegDeviationBelow {
            mint: [1u8; 32],
            threshold_bps: 50,
        }];
        let b = vec![AtlasCondition::PegDeviationBelow {
            mint: [1u8; 32],
            threshold_bps: 80,
        }];
        assert_ne!(conditions_hash(&a), conditions_hash(&b));
    }

    #[test]
    fn hash_is_clause_order_sensitive() {
        // Different from the cohort registry: clause order is part of
        // the canonical layout because it controls evaluation order
        // of mutually dependent gates.
        let a = vec![
            AtlasCondition::RegimeNotCrisisAndOracleFresh,
            AtlasCondition::VaultDefensiveModeFalse,
        ];
        let b = vec![
            AtlasCondition::VaultDefensiveModeFalse,
            AtlasCondition::RegimeNotCrisisAndOracleFresh,
        ];
        assert_ne!(conditions_hash(&a), conditions_hash(&b));
    }

    #[test]
    fn domain_tag_versioning_blocks_collisions() {
        // Hashing the same bytes without the domain tag would land at
        // a different output — pin the tag in.
        let bare = blake3::hash(&[1u8]);
        let with_tag = conditions_hash(&[AtlasCondition::RegimeNotCrisisAndOracleFresh]);
        assert_ne!(*bare.as_bytes(), with_tag);
    }
}
