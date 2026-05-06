//! Confidential-mode compliance integration (directive §7).
//!
//! AML clearance attestation runs before every shielded payout.
//! Travel-rule payloads (above threshold) live off-chain encrypted;
//! only the payload hash hits the on-chain record.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// US travel-rule threshold ($3 000) in Q64. Exact amount can vary
/// by jurisdiction; the strategy commitment declares the per-vault
/// threshold. This constant is a safe default.
pub const TRAVEL_RULE_THRESHOLD_USD_Q64: u128 = 3_000_000_000_u128;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AmlClearance {
    /// Recipient identifier hash — same shape as
    /// `ConfidentialPayrollEntry.recipient_ref_hash`. Sanctions
    /// screening receives the hash + Dodo's account context, never
    /// the cleartext amount.
    pub recipient_ref_hash: [u8; 32],
    /// Dodo signs the attestation; the on-chain verifier reads
    /// the pubkey + signature off-chain via the disclosure path.
    pub provider_signer: Pubkey,
    pub signed_at_unix: u64,
    pub valid_until_unix: u64,
    /// Free-form clearance reference Dodo returns; for replay /
    /// audit only.
    pub clearance_ref: String,
    pub signature: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TravelRulePayloadRef {
    /// Hash of the off-chain encrypted originator + beneficiary
    /// payload. The on-chain record carries this hash; the payload
    /// itself is sent to the receiving institution per regulation.
    pub payload_hash: [u8; 32],
    pub recipient_jurisdiction: String,
    pub originator_jurisdiction: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AmlClearanceError {
    #[error("AML clearance signature length {0} != 64")]
    BadSignatureLength(usize),
    #[error("AML clearance expired: now={now}, valid_until={valid_until}")]
    Expired { now: u64, valid_until: u64 },
    #[error("recipient mismatch: clearance for {clearance:?}, payment to {payment:?}")]
    RecipientMismatch {
        clearance: [u8; 32],
        payment: [u8; 32],
    },
    #[error("provider signer null — refusing to accept unsigned clearance")]
    NullSigner,
}

impl AmlClearance {
    pub fn validate(
        &self,
        payment_recipient_hash: &[u8; 32],
        now_unix: u64,
    ) -> Result<(), AmlClearanceError> {
        if self.signature.len() != 64 {
            return Err(AmlClearanceError::BadSignatureLength(self.signature.len()));
        }
        if self.provider_signer == [0u8; 32] {
            return Err(AmlClearanceError::NullSigner);
        }
        if now_unix >= self.valid_until_unix {
            return Err(AmlClearanceError::Expired {
                now: now_unix,
                valid_until: self.valid_until_unix,
            });
        }
        if &self.recipient_ref_hash != payment_recipient_hash {
            return Err(AmlClearanceError::RecipientMismatch {
                clearance: self.recipient_ref_hash,
                payment: *payment_recipient_hash,
            });
        }
        Ok(())
    }
}

/// True iff the payment notional triggers travel-rule reporting.
pub fn requires_travel_rule_payload(amount_q64: u128) -> bool {
    amount_q64 >= TRAVEL_RULE_THRESHOLD_USD_Q64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clearance(valid_until: u64, recipient: [u8; 32]) -> AmlClearance {
        AmlClearance {
            recipient_ref_hash: recipient,
            provider_signer: [9u8; 32],
            signed_at_unix: 1_000,
            valid_until_unix: valid_until,
            clearance_ref: "dodo_aml_xyz".into(),
            signature: vec![0u8; 64],
        }
    }

    #[test]
    fn good_clearance_passes() {
        clearance(2_000, [1u8; 32]).validate(&[1u8; 32], 1_500).unwrap();
    }

    #[test]
    fn expired_clearance_rejects() {
        let r = clearance(2_000, [1u8; 32]).validate(&[1u8; 32], 5_000);
        assert!(matches!(r, Err(AmlClearanceError::Expired { .. })));
    }

    #[test]
    fn recipient_mismatch_rejects() {
        let r = clearance(2_000, [1u8; 32]).validate(&[2u8; 32], 1_500);
        assert!(matches!(r, Err(AmlClearanceError::RecipientMismatch { .. })));
    }

    #[test]
    fn bad_signature_length_rejects() {
        let mut c = clearance(2_000, [1u8; 32]);
        c.signature = vec![];
        let r = c.validate(&[1u8; 32], 1_500);
        assert!(matches!(r, Err(AmlClearanceError::BadSignatureLength(_))));
    }

    #[test]
    fn null_signer_rejects() {
        let mut c = clearance(2_000, [1u8; 32]);
        c.provider_signer = [0u8; 32];
        let r = c.validate(&[1u8; 32], 1_500);
        assert!(matches!(r, Err(AmlClearanceError::NullSigner)));
    }

    #[test]
    fn travel_rule_threshold_predicate() {
        assert!(!requires_travel_rule_payload(2_000_000_000));
        assert!(requires_travel_rule_payload(TRAVEL_RULE_THRESHOLD_USD_Q64));
        assert!(requires_travel_rule_payload(10_000_000_000));
    }
}
