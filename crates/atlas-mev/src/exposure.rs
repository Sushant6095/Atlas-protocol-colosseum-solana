//! MEV exposure scoring (directive §7.2).
//!
//! Inputs: a `(slot, position_in_block)` window centered on Atlas's
//! own bundle, plus the set of "touched pool" pubkeys for each
//! transaction. Exposure score is computed as:
//!
//! * `adjacency` — count of transactions within ±N positions of our
//!   bundle that touch any pool we touched. N = 4 (a typical sandwich
//!   distance).
//! * `pool_overlap_bps` — fraction of our pool set covered by the
//!   adjacency, in bps. 10_000 means every pool we touched also
//!   appeared in adjacent transactions.
//! * `bracket_signature` — `[u8; 32]` blake3 over the pubkeys of the
//!   adjacent transactions. Used by the forensic engine to dedup
//!   repeated anomaly fingerprints.
//!
//! `score_bps` is a convenience: `pool_overlap_bps * adjacency_factor`
//! where `adjacency_factor = (adjacency+1).clamp(1,8)`. Higher is
//! more suspicious.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const ADJACENCY_WINDOW: usize = 4;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockTx {
    /// Solana signature — 64 raw bytes; stored as `Vec<u8>` so serde
    /// derives work natively. Caller asserts `len() == 64`.
    pub signature: Vec<u8>,
    pub slot: u64,
    /// 0-based position within the slot's block.
    pub position: u32,
    /// Set of pool pubkeys this transaction touched.
    pub touched_pools: BTreeSet<Pubkey>,
    /// True iff this is Atlas's own bundle transaction.
    pub is_atlas: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MevExposureScore {
    pub atlas_position: u32,
    pub adjacency: u32,
    pub pool_overlap_bps: u32,
    pub bracket_signature: [u8; 32],
    pub score_bps: u32,
}

pub fn compute_exposure_score(block: &[BlockTx]) -> Option<MevExposureScore> {
    let atlas = block.iter().find(|t| t.is_atlas)?;
    let lo = atlas.position.saturating_sub(ADJACENCY_WINDOW as u32);
    let hi = atlas.position.saturating_add(ADJACENCY_WINDOW as u32);
    let adjacent: Vec<&BlockTx> = block
        .iter()
        .filter(|t| !t.is_atlas && t.position >= lo && t.position <= hi)
        .collect();

    let mut overlap_pools: BTreeSet<Pubkey> = BTreeSet::new();
    for tx in &adjacent {
        for p in &tx.touched_pools {
            if atlas.touched_pools.contains(p) {
                overlap_pools.insert(*p);
            }
        }
    }
    let total_pools = atlas.touched_pools.len();
    let pool_overlap_bps = if total_pools == 0 {
        0
    } else {
        ((overlap_pools.len() as u64 * 10_000) / total_pools as u64) as u32
    };

    let adjacency = adjacent.len() as u32;

    let mut h = blake3::Hasher::new();
    h.update(b"atlas.mev.bracket.v1");
    let mut sigs: Vec<Vec<u8>> = adjacent.iter().map(|t| t.signature.clone()).collect();
    sigs.sort();
    for s in &sigs {
        h.update(s);
    }
    let bracket_signature = *h.finalize().as_bytes();

    let adjacency_factor = (adjacency + 1).clamp(1, 8);
    let score_bps = pool_overlap_bps.saturating_mul(adjacency_factor);

    Some(MevExposureScore {
        atlas_position: atlas.position,
        adjacency,
        pool_overlap_bps,
        bracket_signature,
        score_bps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pool(b: u8) -> Pubkey { [b; 32] }

    fn tx(position: u32, pools: &[u8], is_atlas: bool, sig: u8) -> BlockTx {
        BlockTx {
            signature: vec![sig; 64],
            slot: 100,
            position,
            touched_pools: pools.iter().map(|p| pool(*p)).collect(),
            is_atlas,
        }
    }

    #[test]
    fn no_atlas_returns_none() {
        let b = vec![tx(0, &[1], false, 0)];
        assert!(compute_exposure_score(&b).is_none());
    }

    #[test]
    fn no_adjacent_returns_zero_score() {
        let b = vec![
            tx(0, &[1], false, 0),
            tx(20, &[1], true, 1),
            tx(40, &[1], false, 2),
        ];
        let s = compute_exposure_score(&b).unwrap();
        assert_eq!(s.adjacency, 0);
        assert_eq!(s.pool_overlap_bps, 0);
        assert_eq!(s.score_bps, 0);
    }

    #[test]
    fn adjacent_overlap_drives_score() {
        let b = vec![
            tx(8, &[1, 2], false, 0xa),
            tx(10, &[1, 2], true, 0xb),
            tx(11, &[1], false, 0xc),
        ];
        let s = compute_exposure_score(&b).unwrap();
        assert_eq!(s.adjacency, 2);
        // Both pools covered → overlap = 100 % = 10_000 bps.
        assert_eq!(s.pool_overlap_bps, 10_000);
        // adjacency_factor = 3 → 30_000 bps.
        assert_eq!(s.score_bps, 30_000);
    }

    #[test]
    fn bracket_signature_is_order_invariant() {
        let b1 = vec![
            tx(8, &[1, 2], false, 0xa),
            tx(10, &[1, 2], true, 0xb),
            tx(11, &[1, 2], false, 0xc),
        ];
        let b2 = vec![
            tx(11, &[1, 2], false, 0xc),
            tx(10, &[1, 2], true, 0xb),
            tx(8, &[1, 2], false, 0xa),
        ];
        let s1 = compute_exposure_score(&b1).unwrap();
        let s2 = compute_exposure_score(&b2).unwrap();
        assert_eq!(s1.bracket_signature, s2.bracket_signature);
    }
}
