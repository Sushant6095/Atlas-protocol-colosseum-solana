//! Receipt-tree shape + leaf canonicalization + depth selection.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Floor on tree depth — directive sizes vault trees for at least
/// 8 entries (3 bits) so the smallest vault still has a valid tree.
pub const MIN_DEPTH: u8 = 3;
/// Ceiling on tree depth — Bubblegum / SPL Account Compression caps
/// concurrent merkle trees at 30. Going past this requires a
/// canopy-only configuration which is outside the directive shape.
pub const MAX_DEPTH: u8 = 30;
/// Directive §5.2: depth chosen so `2^depth ≥ projected_lifetime × 4`.
pub const SAFETY_FACTOR: u64 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[repr(u8)]
pub enum ReceiptStatus {
    Landed = 1,
    Aborted = 2,
    Rejected = 3,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ReceiptTreeError {
    #[error("tree depth {0} is below MIN_DEPTH ({MIN_DEPTH})")]
    DepthTooSmall(u8),
    #[error("tree depth {0} is above MAX_DEPTH ({MAX_DEPTH})")]
    DepthTooLarge(u8),
    #[error("tree is full at depth {depth}; capacity {capacity}")]
    Full { depth: u8, capacity: u64 },
}

/// Authority over the tree — the rebalancer keeper signs the
/// `append_leaf` ix on behalf of `atlas_archive` PDA (§5.2).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TreeAuthority {
    pub atlas_archive_pda: Pubkey,
    pub bump: u8,
}

/// Leaf canonical bytes (directive §5.2):
/// `leaf = blake3("atlas.receipt.v1" || rebalance_id || slot_le ||
///   public_input_hash || status_byte)`.
pub fn receipt_leaf(
    rebalance_id: &[u8; 32],
    slot: u64,
    public_input_hash: &[u8; 32],
    status: ReceiptStatus,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.receipt.v1");
    h.update(rebalance_id);
    h.update(&slot.to_le_bytes());
    h.update(public_input_hash);
    h.update(&[status as u8]);
    *h.finalize().as_bytes()
}

/// Pick a tree depth for a projected lifetime. The directive's rule:
/// `2^depth ≥ projected_lifetime × SAFETY_FACTOR`.
pub fn select_depth(projected_lifetime: u64) -> Result<u8, ReceiptTreeError> {
    if projected_lifetime == 0 {
        return Ok(MIN_DEPTH);
    }
    let target = projected_lifetime.saturating_mul(SAFETY_FACTOR);
    let mut d: u8 = MIN_DEPTH;
    while d <= MAX_DEPTH {
        if (1u64 << d as u64) >= target {
            return Ok(d);
        }
        d += 1;
    }
    Err(ReceiptTreeError::DepthTooLarge(MAX_DEPTH + 1))
}

/// In-memory concurrent merkle tree. Tracks the current root + every
/// appended leaf so callers can build proofs offline. The on-chain
/// concurrent merkle tree uses canopy storage for proof reuse — this
/// crate models the canonical state without that optimisation.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConcurrentMerkleTree {
    pub depth: u8,
    pub leaves: Vec<[u8; 32]>,
    pub authority: TreeAuthority,
}

impl ConcurrentMerkleTree {
    pub fn new(depth: u8, authority: TreeAuthority) -> Result<Self, ReceiptTreeError> {
        if depth < MIN_DEPTH {
            return Err(ReceiptTreeError::DepthTooSmall(depth));
        }
        if depth > MAX_DEPTH {
            return Err(ReceiptTreeError::DepthTooLarge(depth));
        }
        Ok(Self { depth, leaves: Vec::new(), authority })
    }

    pub fn capacity(&self) -> u64 {
        1u64 << self.depth as u64
    }

    pub fn append(&mut self, leaf: [u8; 32]) -> Result<u64, ReceiptTreeError> {
        if (self.leaves.len() as u64) >= self.capacity() {
            return Err(ReceiptTreeError::Full {
                depth: self.depth,
                capacity: self.capacity(),
            });
        }
        let idx = self.leaves.len() as u64;
        self.leaves.push(leaf);
        Ok(idx)
    }

    /// Compute the current root by hashing the leaves bottom-up,
    /// padding with the zero leaf to `2^depth`. Output matches the
    /// on-chain concurrent merkle tree's notion of "current root".
    pub fn root(&self) -> [u8; 32] {
        let cap = self.capacity() as usize;
        let mut layer: Vec<[u8; 32]> = self.leaves.clone();
        layer.resize(cap, [0u8; 32]);
        while layer.len() > 1 {
            let mut next = Vec::with_capacity(layer.len() / 2);
            for pair in layer.chunks(2) {
                next.push(node(&pair[0], &pair[1]));
            }
            layer = next;
        }
        layer[0]
    }

    /// Build a merkle proof for an existing leaf index. Returns `None`
    /// when the index is out of range.
    pub fn proof(&self, leaf_index: u64) -> Option<crate::proof::MerkleProof> {
        if (leaf_index as usize) >= self.leaves.len() {
            return None;
        }
        let cap = self.capacity() as usize;
        let mut layer: Vec<[u8; 32]> = self.leaves.clone();
        layer.resize(cap, [0u8; 32]);
        let mut path: Vec<[u8; 32]> = Vec::with_capacity(self.depth as usize);
        let mut idx = leaf_index as usize;
        while layer.len() > 1 {
            let sibling = if idx % 2 == 0 {
                layer[idx + 1]
            } else {
                layer[idx - 1]
            };
            path.push(sibling);
            idx /= 2;
            let mut next = Vec::with_capacity(layer.len() / 2);
            for pair in layer.chunks(2) {
                next.push(node(&pair[0], &pair[1]));
            }
            layer = next;
        }
        Some(crate::proof::MerkleProof {
            leaf: self.leaves[leaf_index as usize],
            leaf_index,
            path,
        })
    }
}

/// Domain-tagged internal-node hash. Matches the same shape used by
/// the warehouse Bubblegum module.
fn node(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.receipt.node.v1");
    h.update(a);
    h.update(b);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn auth() -> TreeAuthority {
        TreeAuthority { atlas_archive_pda: [9u8; 32], bump: 255 }
    }

    #[test]
    fn leaf_changes_when_status_changes() {
        let r = [1u8; 32];
        let p = [2u8; 32];
        let landed = receipt_leaf(&r, 100, &p, ReceiptStatus::Landed);
        let aborted = receipt_leaf(&r, 100, &p, ReceiptStatus::Aborted);
        assert_ne!(landed, aborted);
    }

    #[test]
    fn leaf_is_deterministic() {
        let r = [1u8; 32];
        let p = [2u8; 32];
        let a = receipt_leaf(&r, 100, &p, ReceiptStatus::Landed);
        let b = receipt_leaf(&r, 100, &p, ReceiptStatus::Landed);
        assert_eq!(a, b);
    }

    #[test]
    fn select_depth_satisfies_safety_factor() {
        // 2200 records × 4 = 8800 → smallest power of 2 ≥ 8800 is 16384 = 2^14.
        let d = select_depth(2200).unwrap();
        assert_eq!(d, 14);
        assert!(1u64 << d as u64 >= 2200 * SAFETY_FACTOR);
    }

    #[test]
    fn select_depth_for_small_lifetime_floors_at_min() {
        let d = select_depth(1).unwrap();
        assert_eq!(d, MIN_DEPTH);
    }

    #[test]
    fn append_increments_root() {
        let mut t = ConcurrentMerkleTree::new(8, auth()).unwrap();
        let r0 = t.root();
        t.append([1u8; 32]).unwrap();
        let r1 = t.root();
        t.append([2u8; 32]).unwrap();
        let r2 = t.root();
        assert_ne!(r0, r1);
        assert_ne!(r1, r2);
    }

    #[test]
    fn append_rejects_when_full() {
        let mut t = ConcurrentMerkleTree::new(MIN_DEPTH, auth()).unwrap();
        for i in 0..(t.capacity()) {
            t.append([(i & 0xff) as u8; 32]).unwrap();
        }
        assert!(matches!(
            t.append([0u8; 32]),
            Err(ReceiptTreeError::Full { .. })
        ));
    }

    #[test]
    fn proof_round_trips_against_root() {
        let mut t = ConcurrentMerkleTree::new(8, auth()).unwrap();
        for i in 0..7u8 {
            t.append([i; 32]).unwrap();
        }
        let proof = t.proof(3).unwrap();
        let root = t.root();
        assert!(crate::proof::verify_proof(&proof, &root).is_ok());
    }

    #[test]
    fn min_max_depth_bounds_enforced() {
        assert!(matches!(
            ConcurrentMerkleTree::new(MIN_DEPTH - 1, auth()),
            Err(ReceiptTreeError::DepthTooSmall(_))
        ));
        assert!(matches!(
            ConcurrentMerkleTree::new(MAX_DEPTH + 1, auth()),
            Err(ReceiptTreeError::DepthTooLarge(_))
        ));
    }
}
