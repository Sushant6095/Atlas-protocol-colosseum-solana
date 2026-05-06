//! Merkle proof shape + verification (directive §5.3).

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleProof {
    pub leaf: [u8; 32],
    pub leaf_index: u64,
    /// Sibling hashes from leaf-level upward.
    pub path: Vec<[u8; 32]>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ProofError {
    #[error("reconstructed root {got:?} != on-chain root {expected:?}")]
    RootMismatch { expected: [u8; 32], got: [u8; 32] },
}

/// Reconstruct the root from `proof` and compare to `expected_root`.
/// Caller pulls `expected_root` from the vault state field updated
/// atomically with the rebalance (§5.3).
pub fn verify_proof(proof: &MerkleProof, expected_root: &[u8; 32]) -> Result<(), ProofError> {
    let mut current = proof.leaf;
    let mut idx = proof.leaf_index;
    for sibling in &proof.path {
        current = if idx % 2 == 0 {
            node(&current, sibling)
        } else {
            node(sibling, &current)
        };
        idx /= 2;
    }
    if &current != expected_root {
        return Err(ProofError::RootMismatch {
            expected: *expected_root,
            got: current,
        });
    }
    Ok(())
}

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
    use crate::tree::{ConcurrentMerkleTree, TreeAuthority};

    fn auth() -> TreeAuthority {
        TreeAuthority { atlas_archive_pda: [9u8; 32], bump: 255 }
    }

    #[test]
    fn good_proof_verifies() {
        let mut t = ConcurrentMerkleTree::new(8, auth()).unwrap();
        for i in 0..5u8 {
            t.append([i; 32]).unwrap();
        }
        let proof = t.proof(2).unwrap();
        verify_proof(&proof, &t.root()).unwrap();
    }

    #[test]
    fn tampered_leaf_rejects() {
        let mut t = ConcurrentMerkleTree::new(8, auth()).unwrap();
        for i in 0..5u8 {
            t.append([i; 32]).unwrap();
        }
        let mut proof = t.proof(2).unwrap();
        proof.leaf[0] ^= 0xff;
        assert!(matches!(
            verify_proof(&proof, &t.root()),
            Err(ProofError::RootMismatch { .. })
        ));
    }

    #[test]
    fn tampered_path_rejects() {
        let mut t = ConcurrentMerkleTree::new(8, auth()).unwrap();
        for i in 0..5u8 {
            t.append([i; 32]).unwrap();
        }
        let mut proof = t.proof(2).unwrap();
        if !proof.path.is_empty() {
            proof.path[0][0] ^= 0xff;
        }
        assert!(matches!(
            verify_proof(&proof, &t.root()),
            Err(ProofError::RootMismatch { .. })
        ));
    }
}
