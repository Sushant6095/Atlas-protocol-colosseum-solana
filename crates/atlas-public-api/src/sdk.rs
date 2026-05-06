//! SDK-side proof verification (directive §7.2 last bullet).
//!
//! `client.verifyProof(rebalance)` fetches the proof + public input
//! and runs Groth16 verification client-side. Lets a third party
//! verify Atlas without trusting Atlas's API. The actual sp1-solana
//! verify lives in `programs/atlas-verifier`; this module exposes the
//! response shape + a sanity check that the response carries every
//! field a client-side verifier needs.

use atlas_blackbox::BlackBoxRecord;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProofResponse {
    pub public_input_hex: String,
    pub proof_bytes: Vec<u8>,
    pub archive_root_slot: u64,
    pub archive_root: [u8; 32],
    pub merkle_proof_path: Vec<[u8; 32]>,
    pub blackbox: BlackBoxRecord,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ApiVerifyError {
    #[error("public input hex must be 268*2 = 536 chars (got {0})")]
    BadPublicInputLength(usize),
    #[error("proof bytes empty — verifier cannot run")]
    EmptyProof,
    #[error("merkle proof path empty — Bubblegum reconstruction needs at least one sibling")]
    EmptyMerkleProof,
}

/// Sanity-check a `ProofResponse` before handing it to the on-chain
/// verifier. The actual cryptographic verification is delegated to
/// `sp1-solana` against the already-deployed verifier program.
pub fn verify_proof_response(r: &ProofResponse) -> Result<(), ApiVerifyError> {
    if r.public_input_hex.len() != 536 {
        return Err(ApiVerifyError::BadPublicInputLength(r.public_input_hex.len()));
    }
    if r.proof_bytes.is_empty() {
        return Err(ApiVerifyError::EmptyProof);
    }
    if r.merkle_proof_path.is_empty() {
        return Err(ApiVerifyError::EmptyMerkleProof);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_blackbox::{BlackBoxStatus, Timings, BLACKBOX_SCHEMA};

    fn skel() -> BlackBoxRecord {
        BlackBoxRecord {
            schema: BLACKBOX_SCHEMA.into(),
            vault_id: [1u8; 32],
            slot: 100,
            status: BlackBoxStatus::Landed,
            before_state_hash: [0u8; 32],
            after_state_hash: Some([0u8; 32]),
            balances_before: vec![1_000, 2_000],
            balances_after: Some(vec![1_500, 1_500]),
            feature_root: [0u8; 32],
            consensus_root: [0u8; 32],
            agent_proposals_uri: "s3://a".into(),
            explanation_hash: [0u8; 32],
            explanation_canonical_uri: "s3://b".into(),
            risk_state_hash: [0u8; 32],
            risk_topology_uri: "s3://c".into(),
            public_input_hex: "00".repeat(268),
            proof_uri: "s3://d".into(),
            cpi_trace: vec![],
            post_conditions: vec![],
            failure_class: None,
            tx_signature: Some(vec![0u8; 64]),
            landed_slot: Some(101),
            bundle_id: [0u8; 32],
            prover_id: [0u8; 32],
            timings_ms: Timings::default(),
            telemetry_span_id: "x".into(),
        }
    }

    fn good() -> ProofResponse {
        ProofResponse {
            public_input_hex: "00".repeat(268),
            proof_bytes: vec![1u8; 192],
            archive_root_slot: 200,
            archive_root: [9u8; 32],
            merkle_proof_path: vec![[1u8; 32], [2u8; 32]],
            blackbox: skel(),
        }
    }

    #[test]
    fn good_response_passes_sanity_check() {
        verify_proof_response(&good()).unwrap();
    }

    #[test]
    fn bad_public_input_length_rejects() {
        let mut r = good();
        r.public_input_hex = "ab".into();
        assert!(matches!(verify_proof_response(&r), Err(ApiVerifyError::BadPublicInputLength(2))));
    }

    #[test]
    fn empty_proof_rejects() {
        let mut r = good();
        r.proof_bytes.clear();
        assert!(matches!(verify_proof_response(&r), Err(ApiVerifyError::EmptyProof)));
    }

    #[test]
    fn empty_merkle_proof_rejects() {
        let mut r = good();
        r.merkle_proof_path.clear();
        assert!(matches!(verify_proof_response(&r), Err(ApiVerifyError::EmptyMerkleProof)));
    }
}
