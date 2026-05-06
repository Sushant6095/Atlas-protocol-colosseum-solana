//! Bundle idempotency (directive §6.3).

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// `bundle_id = blake3("atlas.bundle.v1" || public_input_hash ||
///   allocation_root || keeper_nonce_le)`.
pub fn bundle_id(
    public_input_hash: &[u8; 32],
    allocation_root: &[u8; 32],
    keeper_nonce: u64,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.bundle.v1");
    h.update(public_input_hash);
    h.update(allocation_root);
    h.update(&keeper_nonce.to_le_bytes());
    *h.finalize().as_bytes()
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IdempotencyError {
    #[error("bundle id already recorded for this vault")]
    Duplicate,
}

/// Per-vault idempotency guard. The on-chain `record_rb` ix uses the
/// same shape — a sorted set of `bundle_id`s. The off-chain guard
/// short-circuits double submission so we don't pay tx fees just to
/// learn the on-chain reject.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct IdempotencyGuard {
    seen: BTreeSet<[u8; 32]>,
}

impl IdempotencyGuard {
    pub fn new() -> Self { Self::default() }

    pub fn try_register(&mut self, id: [u8; 32]) -> Result<(), IdempotencyError> {
        if !self.seen.insert(id) {
            return Err(IdempotencyError::Duplicate);
        }
        Ok(())
    }

    pub fn contains(&self, id: &[u8; 32]) -> bool {
        self.seen.contains(id)
    }

    pub fn len(&self) -> usize { self.seen.len() }
    pub fn is_empty(&self) -> bool { self.seen.is_empty() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundle_id_changes_on_inputs() {
        let a = bundle_id(&[1; 32], &[2; 32], 1);
        let b = bundle_id(&[1; 32], &[2; 32], 2);
        let c = bundle_id(&[1; 32], &[3; 32], 1);
        let d = bundle_id(&[2; 32], &[2; 32], 1);
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert_ne!(a, d);
        // Determinism.
        assert_eq!(a, bundle_id(&[1; 32], &[2; 32], 1));
    }

    #[test]
    fn guard_rejects_duplicate_id() {
        let id = bundle_id(&[1; 32], &[2; 32], 1);
        let mut g = IdempotencyGuard::new();
        g.try_register(id).unwrap();
        assert!(matches!(g.try_register(id), Err(IdempotencyError::Duplicate)));
    }

    #[test]
    fn guard_accepts_distinct_ids() {
        let mut g = IdempotencyGuard::new();
        g.try_register(bundle_id(&[1; 32], &[2; 32], 1)).unwrap();
        g.try_register(bundle_id(&[1; 32], &[2; 32], 2)).unwrap();
        assert_eq!(g.len(), 2);
    }
}
