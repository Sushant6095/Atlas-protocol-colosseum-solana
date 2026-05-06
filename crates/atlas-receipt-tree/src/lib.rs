//! atlas-receipt-tree — per-vault rebalance receipt tree (directive 07 §5).
//!
//! One concurrent merkle tree per vault. Every accepted rebalance
//! appends a leaf:
//!
//! ```text
//! leaf = blake3("atlas.receipt.v1" || rebalance_id || slot_le ||
//!               public_input_hash || status_byte)
//! ```
//!
//! The directive recommends poseidon for on-chain compatibility with
//! sp1-solana; we keep the off-chain library blake3-only because every
//! other Atlas surface (signal_id, alt_id, bundle_id, anchor_leaf) uses
//! the same hash. The on-chain program ships a poseidon mirror in
//! `programs/atlas-archive` (out of workspace).
//!
//! `depth` is chosen so `2^depth ≥ projected_lifetime_records × 4`.
//! `tree_root` is committed in a vault-state field updated atomically
//! with the rebalance; this crate exposes the leaf, depth, root, and
//! merkle proof shapes.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod proof;
pub mod tree;

pub use proof::{verify_proof, MerkleProof, ProofError};
pub use tree::{
    receipt_leaf, select_depth, ConcurrentMerkleTree, ReceiptStatus, ReceiptTreeError,
    TreeAuthority, MAX_DEPTH, MIN_DEPTH, SAFETY_FACTOR,
};
