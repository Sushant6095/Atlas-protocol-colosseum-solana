//! `TreasuryRiskPolicy` (directive §3.2).
//!
//! Policy values become part of the vault's strategy commitment hash;
//! they cannot mutate post-creation. Mutating means creating a new
//! vault and migrating capital under multisig governance.

use atlas_failure::class::ProtocolId;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TreasuryRiskPolicy {
    pub max_exposure_per_protocol_bps: u32,
    pub approved_protocols: Vec<ProtocolId>,
    pub min_idle_buffer_bps: u32,
    pub max_drawdown_bps_24h: u32,
    pub max_oracle_deviation_bps: u32,
    pub pause_signers_required: u8,
    pub rebalance_cooldown_slots: u64,
    /// Safe address for an emergency-reserve pull (§7.2). Typically
    /// the treasury's Squads multisig.
    pub emergency_recipient: Pubkey,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PolicyError {
    #[error("max_exposure_per_protocol_bps {got} exceeds 10_000")]
    ExposureAboveUnit { got: u32 },
    #[error("min_idle_buffer_bps {got} exceeds 10_000")]
    BufferAboveUnit { got: u32 },
    #[error("approved_protocols list is empty")]
    EmptyProtocols,
    #[error("pause_signers_required must be > 0")]
    ZeroSigners,
    #[error("max_drawdown_bps_24h must be > 0")]
    ZeroDrawdownGate,
    #[error("emergency_recipient must be a non-zero pubkey")]
    EmergencyRecipientNull,
}

impl TreasuryRiskPolicy {
    pub fn validate(&self) -> Result<(), PolicyError> {
        if self.max_exposure_per_protocol_bps > 10_000 {
            return Err(PolicyError::ExposureAboveUnit {
                got: self.max_exposure_per_protocol_bps,
            });
        }
        if self.min_idle_buffer_bps > 10_000 {
            return Err(PolicyError::BufferAboveUnit { got: self.min_idle_buffer_bps });
        }
        if self.approved_protocols.is_empty() {
            return Err(PolicyError::EmptyProtocols);
        }
        if self.pause_signers_required == 0 {
            return Err(PolicyError::ZeroSigners);
        }
        if self.max_drawdown_bps_24h == 0 {
            return Err(PolicyError::ZeroDrawdownGate);
        }
        if self.emergency_recipient == [0u8; 32] {
            return Err(PolicyError::EmergencyRecipientNull);
        }
        Ok(())
    }
}

/// `commitment_hash = blake3("atlas.treasury.policy.v1" || canonical bytes)`.
pub fn policy_commitment_hash(p: &TreasuryRiskPolicy) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.treasury.policy.v1");
    h.update(&p.max_exposure_per_protocol_bps.to_le_bytes());
    let mut sorted = p.approved_protocols.clone();
    sorted.sort_by_key(|x| x.0);
    for proto in &sorted {
        h.update(&[proto.0]);
    }
    h.update(&p.min_idle_buffer_bps.to_le_bytes());
    h.update(&p.max_drawdown_bps_24h.to_le_bytes());
    h.update(&p.max_oracle_deviation_bps.to_le_bytes());
    h.update(&[p.pause_signers_required]);
    h.update(&p.rebalance_cooldown_slots.to_le_bytes());
    h.update(&p.emergency_recipient);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn good() -> TreasuryRiskPolicy {
        TreasuryRiskPolicy {
            max_exposure_per_protocol_bps: 5_000,
            approved_protocols: vec![ProtocolId(1), ProtocolId(2)],
            min_idle_buffer_bps: 2_000,
            max_drawdown_bps_24h: 500,
            max_oracle_deviation_bps: 100,
            pause_signers_required: 2,
            rebalance_cooldown_slots: 9_000,
            emergency_recipient: [9u8; 32],
        }
    }

    #[test]
    fn good_policy_validates() {
        good().validate().unwrap();
    }

    #[test]
    fn buffer_above_unit_rejects() {
        let mut p = good();
        p.min_idle_buffer_bps = 10_001;
        assert!(matches!(p.validate(), Err(PolicyError::BufferAboveUnit { .. })));
    }

    #[test]
    fn empty_protocols_rejects() {
        let mut p = good();
        p.approved_protocols.clear();
        assert!(matches!(p.validate(), Err(PolicyError::EmptyProtocols)));
    }

    #[test]
    fn zero_signers_rejects() {
        let mut p = good();
        p.pause_signers_required = 0;
        assert!(matches!(p.validate(), Err(PolicyError::ZeroSigners)));
    }

    #[test]
    fn zero_emergency_recipient_rejects() {
        let mut p = good();
        p.emergency_recipient = [0u8; 32];
        assert!(matches!(p.validate(), Err(PolicyError::EmergencyRecipientNull)));
    }

    #[test]
    fn commitment_is_protocol_order_invariant() {
        let mut a = good();
        let mut b = good();
        a.approved_protocols = vec![ProtocolId(1), ProtocolId(2), ProtocolId(3)];
        b.approved_protocols = vec![ProtocolId(3), ProtocolId(1), ProtocolId(2)];
        assert_eq!(policy_commitment_hash(&a), policy_commitment_hash(&b));
    }

    #[test]
    fn commitment_changes_when_policy_changes() {
        let a = good();
        let mut b = good();
        b.max_drawdown_bps_24h = 1_000;
        assert_ne!(policy_commitment_hash(&a), policy_commitment_hash(&b));
    }
}
