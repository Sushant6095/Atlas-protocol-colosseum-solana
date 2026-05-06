//! Pedersen / ElGamal commitment shapes + range-proof contract.
//!
//! Real curve math lives in the on-chain Token-2022
//! ConfidentialTransfer extension and the Cloak shielded program;
//! this crate models the off-chain shapes and the homomorphic
//! aggregation invariants the verifier relies on.
//!
//! Aggregation invariant: for the rebalance proof to verify, the
//! sum of per-protocol commitments must equal the
//! `state_commitment_root` for the vault. We model that with
//! additive commitments under a single 32-byte representation.

use serde::{Deserialize, Serialize};

pub const RANGE_PROOF_DOMAIN: &[u8] = b"atlas.range_proof.v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AmountCommitment {
    /// 32-byte commitment to a confidential amount. Production wires
    /// this to the on-chain Pedersen / ElGamal type; off-chain we
    /// treat it as opaque bytes derived from `amount + blinding`.
    pub bytes: [u8; 32],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PedersenBlinding {
    pub bytes: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RangeProof {
    /// Domain-tagged proof bytes. Validated by the on-chain extension
    /// (Pattern A) or the Cloak shielded program (Pattern B). Range
    /// proofs are mandatory in confidential transfers (anti-pattern
    /// §8 third bullet enforced).
    pub bytes: Vec<u8>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CommitmentError {
    #[error("commitment bytes empty")]
    EmptyCommitment,
    #[error("range proof bytes empty — confidential transfers require a range proof")]
    EmptyRangeProof,
    #[error("range proof domain tag does not match `atlas.range_proof.v1`")]
    BadDomainTag,
    #[error("aggregate mismatch: expected {expected:?}, computed {computed:?}")]
    AggregateMismatch { expected: [u8; 32], computed: [u8; 32] },
}

/// Off-chain stand-in for additive commitment aggregation. The
/// production verifier uses real curve arithmetic; this model
/// validates the contract — sum of children commitments must match
/// the parent. We hash the sorted children's bytes into a stable
/// 32-byte aggregate.
pub fn aggregate_commitments(children: &[AmountCommitment]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.commitment.aggregate.v1");
    let mut sorted: Vec<&AmountCommitment> = children.iter().collect();
    sorted.sort_by(|a, b| a.bytes.cmp(&b.bytes));
    for c in sorted {
        h.update(&c.bytes);
    }
    *h.finalize().as_bytes()
}

/// Verify a range proof's shape — the on-chain primitive does the
/// actual cryptographic validation; this crate enforces the domain
/// tag the off-chain pipeline must produce.
pub fn verify_range_proof(p: &RangeProof) -> Result<(), CommitmentError> {
    if p.bytes.is_empty() {
        return Err(CommitmentError::EmptyRangeProof);
    }
    if !p.bytes.starts_with(RANGE_PROOF_DOMAIN) {
        return Err(CommitmentError::BadDomainTag);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cm(b: u8) -> AmountCommitment { AmountCommitment { bytes: [b; 32] } }

    #[test]
    fn aggregate_is_order_invariant() {
        let a = aggregate_commitments(&[cm(1), cm(2), cm(3)]);
        let b = aggregate_commitments(&[cm(3), cm(1), cm(2)]);
        assert_eq!(a, b);
    }

    #[test]
    fn aggregate_changes_when_child_changes() {
        let a = aggregate_commitments(&[cm(1), cm(2)]);
        let b = aggregate_commitments(&[cm(1), cm(3)]);
        assert_ne!(a, b);
    }

    #[test]
    fn empty_range_proof_rejects() {
        let r = verify_range_proof(&RangeProof { bytes: vec![] });
        assert!(matches!(r, Err(CommitmentError::EmptyRangeProof)));
    }

    #[test]
    fn bad_domain_rejects() {
        let r = verify_range_proof(&RangeProof { bytes: b"not-the-domain".to_vec() });
        assert!(matches!(r, Err(CommitmentError::BadDomainTag)));
    }

    #[test]
    fn good_proof_passes() {
        let mut bytes = RANGE_PROOF_DOMAIN.to_vec();
        bytes.extend_from_slice(&[0u8; 32]);
        verify_range_proof(&RangeProof { bytes }).unwrap();
    }
}
