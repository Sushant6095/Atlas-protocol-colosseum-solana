//! Signer set + merkle commitment.
//!
//! A `SignerSet` is a sorted, deduplicated collection of pubkeys with a
//! threshold. Its on-chain commitment is a binary blake3 merkle root over
//! the sorted leaves (each leaf = `blake3("atlas.gov.leaf.v1" || pubkey)`),
//! padded with the zero leaf to the next power of two. This matches the
//! commitment shape used elsewhere in Atlas (Phase 03 Bubblegum) so the
//! verifier can reuse the same merkle path utilities.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub type Pubkey = [u8; 32];

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SignerSetError {
    #[error("threshold {threshold} > signer count {n}")]
    ThresholdAboveCount { threshold: u32, n: u32 },
    #[error("threshold must be > 0")]
    ZeroThreshold,
    #[error("empty signer set")]
    Empty,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignerSet {
    /// Sorted, deduplicated. Use [`SignerSet::new`].
    pub pubkeys: Vec<Pubkey>,
    pub threshold: u32,
}

impl SignerSet {
    pub fn new(pubkeys: impl IntoIterator<Item = Pubkey>, threshold: u32) -> Result<Self, SignerSetError> {
        let mut set: BTreeSet<Pubkey> = pubkeys.into_iter().collect();
        if set.is_empty() {
            return Err(SignerSetError::Empty);
        }
        if threshold == 0 {
            return Err(SignerSetError::ZeroThreshold);
        }
        let n = set.len() as u32;
        if threshold > n {
            return Err(SignerSetError::ThresholdAboveCount { threshold, n });
        }
        Ok(Self {
            pubkeys: std::mem::take(&mut set).into_iter().collect(),
            threshold,
        })
    }

    pub fn contains(&self, k: &Pubkey) -> bool {
        self.pubkeys.binary_search(k).is_ok()
    }

    pub fn root(&self) -> [u8; 32] {
        signer_set_root(&self.pubkeys)
    }
}

/// Compute the signer-set root over a sorted slice of pubkeys.
pub fn signer_set_root(sorted_pubkeys: &[Pubkey]) -> [u8; 32] {
    if sorted_pubkeys.is_empty() {
        return [0u8; 32];
    }
    let leaves: Vec<[u8; 32]> = sorted_pubkeys.iter().map(|k| leaf_hash(k)).collect();
    let n = leaves.len().next_power_of_two();
    let mut padded = leaves;
    padded.resize(n, [0u8; 32]);
    while padded.len() > 1 {
        let mut next = Vec::with_capacity(padded.len() / 2);
        for pair in padded.chunks(2) {
            let mut h = blake3::Hasher::new();
            h.update(b"atlas.gov.node.v1");
            h.update(&pair[0]);
            h.update(&pair[1]);
            next.push(*h.finalize().as_bytes());
        }
        padded = next;
    }
    padded[0]
}

fn leaf_hash(pubkey: &Pubkey) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.gov.leaf.v1");
    h.update(pubkey);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(b: u8) -> Pubkey { [b; 32] }

    #[test]
    fn new_dedups_and_sorts() {
        let s = SignerSet::new([k(3), k(1), k(2), k(1)], 2).unwrap();
        assert_eq!(s.pubkeys, vec![k(1), k(2), k(3)]);
    }

    #[test]
    fn threshold_above_count_rejects() {
        let err = SignerSet::new([k(1), k(2)], 5).unwrap_err();
        assert!(matches!(err, SignerSetError::ThresholdAboveCount { .. }));
    }

    #[test]
    fn root_is_independent_of_input_order() {
        let a = SignerSet::new([k(1), k(2), k(3)], 2).unwrap();
        let b = SignerSet::new([k(3), k(1), k(2)], 2).unwrap();
        assert_eq!(a.root(), b.root());
    }

    #[test]
    fn root_changes_when_signer_changes() {
        let a = SignerSet::new([k(1), k(2), k(3)], 2).unwrap();
        let b = SignerSet::new([k(1), k(2), k(4)], 2).unwrap();
        assert_ne!(a.root(), b.root());
    }

    #[test]
    fn empty_signer_set_rejects() {
        assert!(matches!(
            SignerSet::new(std::iter::empty(), 1),
            Err(SignerSetError::Empty)
        ));
    }

    #[test]
    fn zero_threshold_rejects() {
        assert!(matches!(
            SignerSet::new([k(1)], 0),
            Err(SignerSetError::ZeroThreshold)
        ));
    }

    #[test]
    fn contains_uses_binary_search() {
        let s = SignerSet::new([k(1), k(5), k(9)], 2).unwrap();
        assert!(s.contains(&k(5)));
        assert!(!s.contains(&k(6)));
    }
}
