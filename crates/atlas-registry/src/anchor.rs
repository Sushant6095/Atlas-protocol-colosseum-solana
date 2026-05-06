//! On-chain Bubblegum anchoring (directive §3.2).
//!
//! Every status transition produces a Bubblegum leaf with the tuple
//! `(model_id, prev_status, new_status, signer_set_root, slot)`. The
//! registry's authoritative state can be reconstructed by replaying these
//! leaves plus the content-addressed model artifacts.
//!
//! This module produces the canonical leaf bytes; the actual on-chain
//! anchoring is wired through `atlas_warehouse::bubblegum`.

use crate::record::{ModelId, ModelStatus};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistryAnchor {
    pub model_id: ModelId,
    pub prev_status: Option<ModelStatus>,
    pub new_status: ModelStatus,
    pub signer_set_root: [u8; 32],
    pub slot: u64,
}

/// Canonical Bubblegum leaf bytes for a registry anchor. The ordering and
/// delimiters here are part of the on-chain wire contract — touching this
/// renames the leaf hash and breaks reconstruction.
pub fn anchor_leaf(a: &RegistryAnchor) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.registry.anchor.v1");
    h.update(&a.model_id);
    h.update(&[match a.prev_status {
        Some(ModelStatus::Draft) => 1,
        Some(ModelStatus::Audited) => 2,
        Some(ModelStatus::Approved) => 3,
        Some(ModelStatus::DriftFlagged) => 4,
        Some(ModelStatus::Deprecated) => 5,
        Some(ModelStatus::Slashed) => 6,
        None => 0,
    }]);
    h.update(&[match a.new_status {
        ModelStatus::Draft => 1,
        ModelStatus::Audited => 2,
        ModelStatus::Approved => 3,
        ModelStatus::DriftFlagged => 4,
        ModelStatus::Deprecated => 5,
        ModelStatus::Slashed => 6,
    }]);
    h.update(&a.signer_set_root);
    h.update(&a.slot.to_le_bytes());
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn anchor(prev: Option<ModelStatus>, new: ModelStatus) -> RegistryAnchor {
        RegistryAnchor {
            model_id: [1u8; 32],
            prev_status: prev,
            new_status: new,
            signer_set_root: [2u8; 32],
            slot: 100,
        }
    }

    #[test]
    fn distinct_transitions_have_distinct_leaves() {
        let a = anchor(Some(ModelStatus::Draft), ModelStatus::Audited);
        let b = anchor(Some(ModelStatus::Audited), ModelStatus::Approved);
        assert_ne!(anchor_leaf(&a), anchor_leaf(&b));
    }

    #[test]
    fn slot_change_changes_leaf() {
        let mut a = anchor(Some(ModelStatus::Draft), ModelStatus::Audited);
        let h1 = anchor_leaf(&a);
        a.slot = 101;
        assert_ne!(h1, anchor_leaf(&a));
    }

    #[test]
    fn anchor_leaf_is_deterministic() {
        let a = anchor(Some(ModelStatus::Approved), ModelStatus::DriftFlagged);
        assert_eq!(anchor_leaf(&a), anchor_leaf(&a));
    }
}
