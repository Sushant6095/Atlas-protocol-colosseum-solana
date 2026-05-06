//! atlas-alt — ALT (Address Lookup Table) lifecycle (directive 07 §2).
//!
//! Five rules:
//!
//! 1. **Content addressing.** `alt_id = blake3(sorted_account_set)` —
//!    identical sets across vaults reuse the same ALT.
//! 2. **Chunk-of-30 extension.** `extend_lookup_table` accepts at most
//!    30 keys per call; this crate splits any larger set into 30-sized
//!    chunks ([`extend_chunks`]).
//! 3. **Warm gating.** Only ALTs whose `slot_after_creation > 1` are
//!    referenced (Solana's deactivation cooldown rule).
//! 4. **Refresh, never edit.** Once warm, an ALT is read-only. Protocol
//!    upgrades create a new ALT and deactivate the old one.
//! 5. **Compaction.** Pairs whose intersection / union > 80 % collapse
//!    into a merged ALT.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod compaction;
pub mod lifecycle;

pub use compaction::{compaction_candidates, jaccard_bps, CompactionPair, COMPACTION_THRESHOLD_BPS};
pub use lifecycle::{
    alt_id, extend_chunks, AltError, AltRecord, AltStatus, EXTEND_CHUNK_LIMIT, WARM_SLOT_DELAY,
};
