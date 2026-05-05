//! Domain-separated hashing utilities.
//!
//! Atlas uses Poseidon over BN254 inside the SP1 guest and on-chain
//! (matching the verifier's `alt_bn128` syscalls). The off-chain pipeline
//! must produce byte-identical commitments — therefore this module exposes
//! the exact same domain tags and serialization order as the guest.
//!
//! Phase 1: SHA-256 with versioned domain tags is used as a placeholder so
//! the pipeline compiles and the determinism tests pass against themselves.
//! Phase 2 swaps for `light_poseidon` BN254 Poseidon — the API stays stable.
//!
//! All multi-byte integers are little-endian. All `Pubkey`s are raw 32 bytes.

use sha2::{Digest, Sha256};

pub mod tags {
    pub const SNAPSHOT_V1: &[u8] = b"atlas.snapshot.v1";
    pub const FEATURE_V2: &[u8] = b"atlas.feat.v2";
    pub const ALLOC_V2: &[u8] = b"atlas.alloc.v2";
    pub const EXPLANATION_V2: &[u8] = b"atlas.expl.v2";
    pub const CONSENSUS_V2: &[u8] = b"atlas.consensus.v2";
    pub const RISK_V2: &[u8] = b"atlas.risk.v2";
    pub const ENSEMBLE_V2: &[u8] = b"atlas.ensemble.v2";
}

/// Domain-separated hash. `tag || items[0] || items[1] || ...`.
/// In Phase 2 swap `Sha256::new()` for `Poseidon::new()` (light_poseidon).
pub fn hash_with_tag(tag: &[u8], items: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update((tag.len() as u32).to_le_bytes());
    h.update(tag);
    for it in items {
        h.update((it.len() as u32).to_le_bytes());
        h.update(it);
    }
    h.finalize().into()
}

/// Hash an ordered sequence of leaves into a tag-separated root.
/// I-6: caller is responsible for sorting the leaves into the documented
/// total order before invocation.
pub fn merkle_with_tag(tag: &[u8], leaves: &[[u8; 32]]) -> [u8; 32] {
    let refs: Vec<&[u8]> = leaves.iter().map(|l| l.as_slice()).collect();
    hash_with_tag(tag, &refs)
}
