//! ALT lifecycle state machine + content addressing.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Solana on-chain limit per `extend_lookup_table` call.
pub const EXTEND_CHUNK_LIMIT: usize = 30;
/// Slots after creation before an ALT is considered warm. Solana's
/// deactivation cooldown is 1 slot; we observe `> 1` to be safe.
pub const WARM_SLOT_DELAY: u64 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AltStatus {
    Pending,
    Warm,
    Refreshing,
    Deactivated,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AltError {
    #[error("empty ALT — at least one account required")]
    Empty,
    #[error("ALT not yet warm: created_at_slot={created_at_slot}, current_slot={current_slot}")]
    NotWarm { created_at_slot: u64, current_slot: u64 },
    #[error("ALT already deactivated; refresh requires a new ALT")]
    AlreadyDeactivated,
    #[error("illegal status transition: {from:?} -> {to:?}")]
    IllegalTransition { from: AltStatus, to: AltStatus },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AltRecord {
    pub alt_id: [u8; 32],
    pub accounts: Vec<Pubkey>,
    pub created_at_slot: u64,
    pub status: AltStatus,
}

impl AltRecord {
    pub fn new(accounts: BTreeSet<Pubkey>, created_at_slot: u64) -> Result<Self, AltError> {
        if accounts.is_empty() {
            return Err(AltError::Empty);
        }
        let sorted: Vec<Pubkey> = accounts.into_iter().collect();
        Ok(Self {
            alt_id: alt_id(&sorted),
            accounts: sorted,
            created_at_slot,
            status: AltStatus::Pending,
        })
    }

    /// Mark as warm if enough slots have passed.
    pub fn mark_warm(&mut self, current_slot: u64) -> Result<(), AltError> {
        if self.status == AltStatus::Deactivated {
            return Err(AltError::AlreadyDeactivated);
        }
        if current_slot <= self.created_at_slot.saturating_add(WARM_SLOT_DELAY) {
            return Err(AltError::NotWarm {
                created_at_slot: self.created_at_slot,
                current_slot,
            });
        }
        if self.status != AltStatus::Pending && self.status != AltStatus::Refreshing {
            return Err(AltError::IllegalTransition {
                from: self.status,
                to: AltStatus::Warm,
            });
        }
        self.status = AltStatus::Warm;
        Ok(())
    }

    pub fn deactivate(&mut self) -> Result<(), AltError> {
        if self.status == AltStatus::Deactivated {
            return Err(AltError::AlreadyDeactivated);
        }
        self.status = AltStatus::Deactivated;
        Ok(())
    }

    pub fn is_referenceable(&self) -> bool {
        matches!(self.status, AltStatus::Warm)
    }
}

/// `alt_id = blake3("atlas.alt.v1" || sorted_account_set)`.
pub fn alt_id(sorted_accounts: &[Pubkey]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.alt.v1");
    for k in sorted_accounts {
        h.update(k);
    }
    *h.finalize().as_bytes()
}

/// Split an account set into chunks of `EXTEND_CHUNK_LIMIT` (30) so
/// each chunk fits one `extend_lookup_table` call.
pub fn extend_chunks(accounts: &[Pubkey]) -> Vec<Vec<Pubkey>> {
    accounts
        .chunks(EXTEND_CHUNK_LIMIT)
        .map(|c| c.to_vec())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(b: u8) -> Pubkey { [b; 32] }

    #[test]
    fn alt_id_independent_of_input_order() {
        let mut s1 = BTreeSet::new();
        s1.extend([k(1), k(2), k(3)]);
        let mut s2 = BTreeSet::new();
        s2.extend([k(3), k(1), k(2)]);
        let a = AltRecord::new(s1, 100).unwrap();
        let b = AltRecord::new(s2, 100).unwrap();
        assert_eq!(a.alt_id, b.alt_id);
    }

    #[test]
    fn alt_id_changes_when_set_changes() {
        let mut s1 = BTreeSet::new();
        s1.extend([k(1), k(2)]);
        let mut s2 = BTreeSet::new();
        s2.extend([k(1), k(3)]);
        assert_ne!(
            AltRecord::new(s1, 100).unwrap().alt_id,
            AltRecord::new(s2, 100).unwrap().alt_id
        );
    }

    #[test]
    fn empty_alt_rejects() {
        assert_eq!(AltRecord::new(BTreeSet::new(), 100), Err(AltError::Empty));
    }

    #[test]
    fn warm_requires_slot_after_creation_strictly_greater_than_one() {
        let mut a = AltRecord::new(BTreeSet::from([k(1)]), 100).unwrap();
        assert!(matches!(a.mark_warm(100), Err(AltError::NotWarm { .. })));
        assert!(matches!(a.mark_warm(101), Err(AltError::NotWarm { .. })));
        a.mark_warm(102).unwrap();
        assert_eq!(a.status, AltStatus::Warm);
    }

    #[test]
    fn extend_chunks_at_most_30() {
        let big: Vec<Pubkey> = (0..75u8).map(k).collect();
        let chunks = extend_chunks(&big);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].len(), 30);
        assert_eq!(chunks[1].len(), 30);
        assert_eq!(chunks[2].len(), 15);
    }

    #[test]
    fn deactivated_blocks_warm_transition() {
        let mut a = AltRecord::new(BTreeSet::from([k(1)]), 100).unwrap();
        a.deactivate().unwrap();
        assert!(matches!(a.mark_warm(200), Err(AltError::AlreadyDeactivated)));
    }

    #[test]
    fn only_warm_alts_are_referenceable() {
        let mut a = AltRecord::new(BTreeSet::from([k(1)]), 100).unwrap();
        assert!(!a.is_referenceable());
        a.mark_warm(200).unwrap();
        assert!(a.is_referenceable());
        a.deactivate().unwrap();
        assert!(!a.is_referenceable());
    }
}
