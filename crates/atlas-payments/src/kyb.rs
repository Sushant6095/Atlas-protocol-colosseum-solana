//! KYB attestation (directive §3.3).
//!
//! Atlas does not perform KYB itself. Dodo signs a payload off-chain;
//! Atlas commits its hash on-chain at entity creation. A regulator
//! request is answered by producing the payload + hash + on-chain
//! commitment. KYB does not give Atlas authority to move funds.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KybProviderId {
    Dodo,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct KybAttestation {
    pub provider: KybProviderId,
    /// URI of the signed payload (typically S3 + sha256 in metadata).
    pub payload_uri: String,
    /// `kyb_commitment_hash` over the canonical bytes; committed
    /// on-chain in `BusinessTreasury.commitment_hash`.
    pub attestation_hash: [u8; 32],
    /// Provider's signing key. The orchestrator verifies the
    /// off-chain payload signature against this key separately;
    /// this crate just stores the contract.
    pub provider_signer: Pubkey,
}

/// `kyb_commitment_hash = blake3("atlas.kyb.attestation.v1" || ...)`.
pub fn kyb_commitment_hash(
    provider: KybProviderId,
    payload_uri: &str,
    payload_bytes_sha256: &[u8; 32],
    provider_signer: &Pubkey,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.kyb.attestation.v1");
    h.update(&[provider as u8]);
    h.update(payload_uri.as_bytes());
    h.update(&[0u8]);
    h.update(payload_bytes_sha256);
    h.update(provider_signer);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_deterministic() {
        let a = kyb_commitment_hash(
            KybProviderId::Dodo,
            "s3://kyb/abc",
            &[1u8; 32],
            &[9u8; 32],
        );
        let b = kyb_commitment_hash(
            KybProviderId::Dodo,
            "s3://kyb/abc",
            &[1u8; 32],
            &[9u8; 32],
        );
        assert_eq!(a, b);
    }

    #[test]
    fn hash_changes_with_provider() {
        let a = kyb_commitment_hash(KybProviderId::Dodo, "uri", &[0u8; 32], &[0u8; 32]);
        let b = kyb_commitment_hash(KybProviderId::Other, "uri", &[0u8; 32], &[0u8; 32]);
        assert_ne!(a, b);
    }

    #[test]
    fn hash_changes_with_payload_uri() {
        let a = kyb_commitment_hash(KybProviderId::Dodo, "uri-a", &[0u8; 32], &[0u8; 32]);
        let b = kyb_commitment_hash(KybProviderId::Dodo, "uri-b", &[0u8; 32], &[0u8; 32]);
        assert_ne!(a, b);
    }

    #[test]
    fn hash_changes_with_payload_bytes() {
        let a = kyb_commitment_hash(KybProviderId::Dodo, "uri", &[0u8; 32], &[0u8; 32]);
        let b = kyb_commitment_hash(KybProviderId::Dodo, "uri", &[1u8; 32], &[0u8; 32]);
        assert_ne!(a, b);
    }
}
