//! `AtlasConditionAttestation` — fresh signature posted by the Atlas
//! keeper that gates trigger execution (directive §3.2).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Maximum slot lag the on-chain `gate_check` accepts. ~1.6 s at 400
/// ms slots × 8 = ~12.8 s of leeway between attestation post and
/// keeper firing — long enough to ride a single missed leader slot,
/// short enough that a stale attestation can't sneak through.
pub const MAX_ATTESTATION_STALE_SLOTS: u64 = 8;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AtlasConditionAttestation {
    pub vault_id: Pubkey,
    pub conditions_hash: [u8; 32],
    pub posted_at_slot: u64,
    /// Atlas verifier authority — the on-chain `TriggerGate` checks
    /// the registered authority key matches this field.
    pub authority: Pubkey,
    /// Ed25519 signature over `(domain || vault_id || conditions_hash
    /// || posted_at_slot)`. Signature verification is the
    /// orchestrator's job; this crate models the predicate.
    pub signature: Vec<u8>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AttestationError {
    #[error("attestation stale: posted_at_slot={posted_at_slot}, current_slot={current_slot}, lag {lag} > {MAX_ATTESTATION_STALE_SLOTS}")]
    Stale {
        posted_at_slot: u64,
        current_slot: u64,
        lag: u64,
    },
    #[error("vault id mismatch: trigger gate expects {expected:?}, attestation carries {got:?}")]
    VaultMismatch { expected: Pubkey, got: Pubkey },
    #[error("authority mismatch: registered {registered:?}, attestation signed by {signed:?}")]
    AuthorityMismatch { registered: Pubkey, signed: Pubkey },
    #[error("signature length {0} != 64")]
    BadSignatureLength(usize),
}

impl AtlasConditionAttestation {
    pub fn check_freshness(&self, current_slot: u64) -> Result<(), AttestationError> {
        let lag = current_slot.saturating_sub(self.posted_at_slot);
        if lag > MAX_ATTESTATION_STALE_SLOTS {
            return Err(AttestationError::Stale {
                posted_at_slot: self.posted_at_slot,
                current_slot,
                lag,
            });
        }
        Ok(())
    }

    pub fn check_vault(&self, expected_vault: &Pubkey) -> Result<(), AttestationError> {
        if &self.vault_id != expected_vault {
            return Err(AttestationError::VaultMismatch {
                expected: *expected_vault,
                got: self.vault_id,
            });
        }
        Ok(())
    }

    pub fn check_authority(&self, registered: &Pubkey) -> Result<(), AttestationError> {
        if &self.authority != registered {
            return Err(AttestationError::AuthorityMismatch {
                registered: *registered,
                signed: self.authority,
            });
        }
        Ok(())
    }

    pub fn check_signature_shape(&self) -> Result<(), AttestationError> {
        if self.signature.len() != 64 {
            return Err(AttestationError::BadSignatureLength(self.signature.len()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn att(posted: u64) -> AtlasConditionAttestation {
        AtlasConditionAttestation {
            vault_id: [1u8; 32],
            conditions_hash: [0u8; 32],
            posted_at_slot: posted,
            authority: [9u8; 32],
            signature: vec![0u8; 64],
        }
    }

    #[test]
    fn fresh_attestation_passes() {
        att(100).check_freshness(102).unwrap();
    }

    #[test]
    fn boundary_stale_slot_passes() {
        att(100).check_freshness(108).unwrap();
    }

    #[test]
    fn one_slot_past_boundary_rejects() {
        let r = att(100).check_freshness(109);
        assert!(matches!(r, Err(AttestationError::Stale { .. })));
    }

    #[test]
    fn vault_mismatch_rejects() {
        let a = att(100);
        let r = a.check_vault(&[2u8; 32]);
        assert!(matches!(r, Err(AttestationError::VaultMismatch { .. })));
    }

    #[test]
    fn authority_mismatch_rejects() {
        let a = att(100);
        let r = a.check_authority(&[7u8; 32]);
        assert!(matches!(r, Err(AttestationError::AuthorityMismatch { .. })));
    }

    #[test]
    fn signature_length_must_be_64() {
        let mut a = att(100);
        a.signature = vec![0u8; 32];
        let r = a.check_signature_shape();
        assert!(matches!(r, Err(AttestationError::BadSignatureLength(32))));
    }
}
