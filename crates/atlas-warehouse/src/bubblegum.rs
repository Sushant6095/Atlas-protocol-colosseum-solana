//! Bubblegum anchoring keeper.
//!
//! Directive §3 final paragraph: receipts batch every N slots, the keeper
//! computes a Merkle root over the batch, and mints a compressed leaf with
//! `(root, slot_low, slot_high)`. The on-chain root commits the warehouse
//! state and is the source of truth for cryptographic forensic claims.
//!
//! This module implements the off-chain side: the Merkle math, the receipt
//! batcher, and the verification function used by external auditors. The
//! actual `spl-account-compression` CPI lands in Phase 4 once the keeper
//! key is provisioned.

use blake3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BubblegumAnchorReceipt {
    /// Slot range covered by the batch (inclusive `slot_low`, inclusive
    /// `slot_high`).
    pub slot_low: u64,
    pub slot_high: u64,
    pub leaf_count: u32,
    pub batch_root: [u8; 32],
}

/// A single Merkle path returned to a forensic auditor. Verifying a leaf
/// against a known on-chain root proves "this rebalance is in the
/// canonical archive".
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MerkleProof {
    pub leaf: [u8; 32],
    pub index: u32,
    pub siblings: Vec<[u8; 32]>,
    pub root: [u8; 32],
}

/// Hash a leaf using a domain-separated tag.
fn hash_leaf(input: &[u8]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.archive.leaf.v1\x00");
    h.update(input);
    h.finalize().into()
}

/// Hash two siblings into their parent.
fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.archive.node.v1\x00");
    h.update(left);
    h.update(right);
    h.finalize().into()
}

/// Compute the Merkle root for a slice of leaf hashes.
/// Pad with `[0u8; 32]` to the next power of two so the tree is balanced —
/// matches the on-chain Bubblegum convention.
pub fn merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return [0u8; 32];
    }
    let mut layer: Vec<[u8; 32]> = leaves.to_vec();
    let target = layer.len().next_power_of_two();
    while layer.len() < target {
        layer.push([0u8; 32]);
    }
    while layer.len() > 1 {
        let mut next = Vec::with_capacity(layer.len() / 2);
        for chunk in layer.chunks(2) {
            let parent = hash_pair(&chunk[0], &chunk[1]);
            next.push(parent);
        }
        layer = next;
    }
    layer[0]
}

/// Build the Merkle proof for `index`. Pads to next power of two like
/// `merkle_root`.
pub fn merkle_path(leaves: &[[u8; 32]], index: u32) -> Option<MerkleProof> {
    if leaves.is_empty() {
        return None;
    }
    let leaf_count = leaves.len();
    if (index as usize) >= leaf_count {
        return None;
    }
    let target = leaf_count.next_power_of_two();
    let mut layer: Vec<[u8; 32]> = leaves.to_vec();
    while layer.len() < target {
        layer.push([0u8; 32]);
    }
    let mut idx = index as usize;
    let leaf = layer[idx];
    let mut siblings = Vec::new();
    while layer.len() > 1 {
        let sibling_idx = idx ^ 1;
        siblings.push(layer[sibling_idx]);
        let mut next = Vec::with_capacity(layer.len() / 2);
        for chunk in layer.chunks(2) {
            next.push(hash_pair(&chunk[0], &chunk[1]));
        }
        idx /= 2;
        layer = next;
    }
    let root = layer[0];
    Some(MerkleProof { leaf, index, siblings, root })
}

/// Verify a Merkle proof against a known root. Auditors use this without
/// trusting the warehouse API.
pub fn verify_path(proof: &MerkleProof) -> bool {
    let mut acc = proof.leaf;
    let mut idx = proof.index as usize;
    for sib in &proof.siblings {
        acc = if idx & 1 == 0 {
            hash_pair(&acc, sib)
        } else {
            hash_pair(sib, &acc)
        };
        idx /= 2;
    }
    acc == proof.root
}

/// Stateful keeper that batches accepted-rebalance leaves and emits anchor
/// receipts ready for on-chain commitment.
pub struct BubblegumAnchorKeeper {
    flush_every_n_leaves: u32,
    pending: Vec<[u8; 32]>,
    pending_slot_low: u64,
    pending_slot_high: u64,
    history: Vec<BubblegumAnchorReceipt>,
}

impl BubblegumAnchorKeeper {
    pub fn new(flush_every_n_leaves: u32) -> Self {
        Self {
            flush_every_n_leaves,
            pending: Vec::new(),
            pending_slot_low: u64::MAX,
            pending_slot_high: 0,
            history: Vec::new(),
        }
    }

    /// Append a serialized rebalance receipt. Returns `Some(receipt)` when the
    /// batch flushed.
    pub fn record(&mut self, slot: u64, receipt_bytes: &[u8]) -> Option<BubblegumAnchorReceipt> {
        let leaf = hash_leaf(receipt_bytes);
        self.pending.push(leaf);
        if slot < self.pending_slot_low {
            self.pending_slot_low = slot;
        }
        if slot > self.pending_slot_high {
            self.pending_slot_high = slot;
        }
        if self.pending.len() as u32 >= self.flush_every_n_leaves {
            Some(self.flush())
        } else {
            None
        }
    }

    pub fn flush(&mut self) -> BubblegumAnchorReceipt {
        let root = merkle_root(&self.pending);
        let receipt = BubblegumAnchorReceipt {
            slot_low: self.pending_slot_low.min(self.pending_slot_high),
            slot_high: self.pending_slot_high,
            leaf_count: self.pending.len() as u32,
            batch_root: root,
        };
        self.history.push(receipt);
        self.pending.clear();
        self.pending_slot_low = u64::MAX;
        self.pending_slot_high = 0;
        receipt
    }

    pub fn history(&self) -> &[BubblegumAnchorReceipt] {
        &self.history
    }

    pub fn pending_len(&self) -> usize {
        self.pending.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_root_is_zero() {
        assert_eq!(merkle_root(&[]), [0u8; 32]);
    }

    #[test]
    fn single_leaf_root_equals_leaf() {
        // next_power_of_two(1) == 1, so no pairing; the root is the leaf itself.
        let l = hash_leaf(b"abc");
        assert_eq!(merkle_root(&[l]), l);
    }

    #[test]
    fn two_leaves_root_is_pair_hash() {
        let a = hash_leaf(b"a");
        let b = hash_leaf(b"b");
        assert_eq!(merkle_root(&[a, b]), hash_pair(&a, &b));
    }

    #[test]
    fn proof_round_trip() {
        let leaves: Vec<[u8; 32]> = (0..7u8).map(|i| hash_leaf(&[i; 1])).collect();
        let root = merkle_root(&leaves);
        for i in 0..leaves.len() {
            let mut proof = merkle_path(&leaves, i as u32).unwrap();
            proof.root = root;
            assert!(verify_path(&proof), "leaf {i} did not verify");
        }
    }

    #[test]
    fn keeper_batches_at_threshold() {
        let mut k = BubblegumAnchorKeeper::new(3);
        assert!(k.record(100, b"a").is_none());
        assert!(k.record(101, b"b").is_none());
        let r = k.record(102, b"c").unwrap();
        assert_eq!(r.leaf_count, 3);
        assert_eq!(r.slot_low, 100);
        assert_eq!(r.slot_high, 102);
        assert_eq!(k.pending_len(), 0);
        assert_eq!(k.history().len(), 1);
    }

    #[test]
    fn flush_with_partial_batch() {
        let mut k = BubblegumAnchorKeeper::new(100);
        let _ = k.record(50, b"x");
        let _ = k.record(51, b"y");
        let r = k.flush();
        assert_eq!(r.leaf_count, 2);
        assert_eq!(r.slot_low, 50);
        assert_eq!(r.slot_high, 51);
    }

    #[test]
    fn deterministic_root_across_runs() {
        let mut a = BubblegumAnchorKeeper::new(10);
        let mut b = BubblegumAnchorKeeper::new(10);
        for slot in 0..7u64 {
            a.record(slot, &slot.to_le_bytes());
            b.record(slot, &slot.to_le_bytes());
        }
        assert_eq!(a.flush(), b.flush());
    }
}
