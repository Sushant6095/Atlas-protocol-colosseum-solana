//! `gate_check` predicate covering directive §3.6 adversarial cases.

use crate::attestation::{AtlasConditionAttestation, AttestationError};
use crate::pda::{TriggerGate, TriggerGateError};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum GateOutcome {
    Allow,
    Reject,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GateError {
    #[error("attestation: {0}")]
    Attestation(#[from] AttestationError),
    #[error("trigger gate: {0}")]
    TriggerGate(#[from] TriggerGateError),
    #[error("conditions hash mismatch: gate.conditions_hash={gate:?}, attestation.conditions_hash={attest:?}")]
    ConditionsMismatch { gate: [u8; 32], attest: [u8; 32] },
}

/// `gate_check` runs the full adversarial-case ladder:
///
/// 1. attestation freshness: `posted_at_slot ≥ current_slot − N` (§3.6 stale).
/// 2. attestation vault matches gate vault (§3.6 wrong vault).
/// 3. attestation conditions byte-equal gate conditions (§3.6 wrong conditions).
/// 4. attestation authority equals registered authority (§3.6 spoofing).
/// 5. signature shape (length 64).
/// 6. gate validity window not expired.
///
/// `Ok(GateOutcome::Allow)` means Jupiter is allowed to consume the
/// trigger; any error means the gate refuses and the trigger is not
/// consumed.
pub fn gate_check(
    gate: &TriggerGate,
    attestation: &AtlasConditionAttestation,
    registered_authority: &Pubkey,
    current_slot: u64,
) -> Result<GateOutcome, GateError> {
    attestation.check_freshness(current_slot)?;
    attestation.check_vault(&gate.vault_id)?;
    attestation.check_authority(registered_authority)?;
    attestation.check_signature_shape()?;
    if attestation.conditions_hash != gate.conditions_hash {
        return Err(GateError::ConditionsMismatch {
            gate: gate.conditions_hash,
            attest: attestation.conditions_hash,
        });
    }
    gate.check_valid(current_slot)?;
    Ok(GateOutcome::Allow)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gate() -> TriggerGate {
        TriggerGate {
            vault_id: [1u8; 32],
            trigger_id: [2u8; 32],
            conditions_hash: [3u8; 32],
            valid_until_slot: 200,
            model_hash: [4u8; 32],
            order_type_tag: 1,
        }
    }

    fn attestation(posted_at_slot: u64) -> AtlasConditionAttestation {
        AtlasConditionAttestation {
            vault_id: [1u8; 32],
            conditions_hash: [3u8; 32],
            posted_at_slot,
            authority: [9u8; 32],
            signature: vec![0u8; 64],
        }
    }

    #[test]
    fn happy_path_allows() {
        let r = gate_check(&gate(), &attestation(100), &[9u8; 32], 102).unwrap();
        assert_eq!(r, GateOutcome::Allow);
    }

    #[test]
    fn stale_attestation_rejects() {
        // posted_at_slot=100, current_slot=109 → lag 9 > 8.
        let r = gate_check(&gate(), &attestation(100), &[9u8; 32], 109);
        assert!(matches!(r, Err(GateError::Attestation(AttestationError::Stale { .. }))));
    }

    #[test]
    fn wrong_vault_rejects() {
        let mut a = attestation(100);
        a.vault_id = [99u8; 32];
        let r = gate_check(&gate(), &a, &[9u8; 32], 102);
        assert!(matches!(r, Err(GateError::Attestation(AttestationError::VaultMismatch { .. }))));
    }

    #[test]
    fn spoofed_authority_rejects() {
        let mut a = attestation(100);
        a.authority = [0xff; 32];
        let r = gate_check(&gate(), &a, &[9u8; 32], 102);
        assert!(matches!(r, Err(GateError::Attestation(AttestationError::AuthorityMismatch { .. }))));
    }

    #[test]
    fn wrong_conditions_rejects() {
        let mut a = attestation(100);
        a.conditions_hash = [0xff; 32];
        let r = gate_check(&gate(), &a, &[9u8; 32], 102);
        assert!(matches!(r, Err(GateError::ConditionsMismatch { .. })));
    }

    #[test]
    fn expired_gate_rejects() {
        let r = gate_check(&gate(), &attestation(199), &[9u8; 32], 200);
        assert!(matches!(r, Err(GateError::TriggerGate(TriggerGateError::Expired { .. }))));
    }

    #[test]
    fn malformed_signature_rejects() {
        let mut a = attestation(100);
        a.signature = vec![];
        let r = gate_check(&gate(), &a, &[9u8; 32], 102);
        assert!(matches!(r, Err(GateError::Attestation(AttestationError::BadSignatureLength(_)))));
    }
}
