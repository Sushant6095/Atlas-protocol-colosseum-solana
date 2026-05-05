//! Stage 08 — GenerateAllocation.
//!
//! Allocation vector entering the proof is `[u32; N]` basis points summing to
//! exactly `10_000` (I-5). Float math is forbidden after this point.
//!
//! Allocation root = `poseidon(b"atlas.alloc.v2", bps[0]_le, bps[1]_le, ..., bps[N-1]_le)`.

use crate::hashing::{hash_with_tag, tags};
use crate::stage::StageError;

pub const TOTAL_BPS: u32 = 10_000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AllocationVectorBps {
    /// Indexed by protocol id (0..N-1). Sum must equal TOTAL_BPS.
    pub bps: Vec<u32>,
    pub allocation_root: [u8; 32],
}

impl AllocationVectorBps {
    pub fn try_new(bps: Vec<u32>) -> Result<Self, StageError> {
        let sum: u64 = bps.iter().map(|x| *x as u64).sum();
        if sum != TOTAL_BPS as u64 {
            return Err(StageError::InvariantViolation {
                stage: "08-generate-allocation",
                detail: format!("allocation sum {} != {}", sum, TOTAL_BPS),
            });
        }
        let bytes: Vec<[u8; 4]> = bps.iter().map(|x| x.to_le_bytes()).collect();
        let refs: Vec<&[u8]> = bytes.iter().map(|b| b.as_slice()).collect();
        let allocation_root = hash_with_tag(tags::ALLOC_V2, &refs);
        Ok(Self { bps, allocation_root })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_10000_sum() {
        let err = AllocationVectorBps::try_new(vec![5_000, 4_000, 999]).unwrap_err();
        assert!(matches!(err, StageError::InvariantViolation { .. }));
    }

    #[test]
    fn accepts_canonical_sum() {
        let v = AllocationVectorBps::try_new(vec![4_000, 2_500, 2_000, 1_000, 500]).unwrap();
        assert_eq!(v.bps.iter().sum::<u32>(), TOTAL_BPS);
        assert_eq!(v.allocation_root.len(), 32);
    }

    #[test]
    fn root_deterministic_across_runs() {
        let a = AllocationVectorBps::try_new(vec![4_000, 2_500, 2_000, 1_000, 500]).unwrap();
        let b = AllocationVectorBps::try_new(vec![4_000, 2_500, 2_000, 1_000, 500]).unwrap();
        assert_eq!(a.allocation_root, b.allocation_root);
    }
}
