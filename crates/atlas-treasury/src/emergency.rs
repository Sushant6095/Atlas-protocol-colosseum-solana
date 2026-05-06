//! Emergency reserve pull (directive §7.2).
//!
//! Atlas is non-custodial — the multisig signs. This module produces
//! a typed `EmergencyPullProposal` the treasury operator queues into
//! Squads with full Phase 05 black-box context. Auto-signing is
//! forbidden (anti-pattern §11).

use crate::entity::TreasuryEntity;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmergencyPullProposal {
    pub treasury_entity_id: [u8; 32],
    pub vault_id: Pubkey,
    pub amount_q64: u128,
    pub recipient: Pubkey,
    /// Hash of the Phase 05 black-box record that motivated the pull.
    pub blackbox_record_hash: [u8; 32],
    /// `proposal_id = blake3("atlas.treasury.emergency.v1" || ...)`.
    pub proposal_id: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EmergencyPullError {
    #[error("vault {0:?} is not owned by this treasury entity")]
    VaultNotOwned(Pubkey),
    #[error("recipient {0:?} != treasury policy emergency_recipient — Atlas refuses")]
    RecipientMismatch(Pubkey),
    #[error("amount must be non-zero")]
    ZeroAmount,
}

/// Construct a multisig-queued proposal. The proposal is **not**
/// auto-signed — the caller hands it to the multisig queue with the
/// `blackbox_record_hash` so the signers see the same Phase 05
/// context the alert engine paged on.
pub fn prepare_emergency_pull(
    entity: &TreasuryEntity,
    vault_id: Pubkey,
    amount_q64: u128,
    blackbox_record_hash: [u8; 32],
    requested_recipient: Pubkey,
) -> Result<EmergencyPullProposal, EmergencyPullError> {
    if !entity.owned_vaults.contains(&vault_id) {
        return Err(EmergencyPullError::VaultNotOwned(vault_id));
    }
    if requested_recipient != entity.risk_policy.emergency_recipient {
        return Err(EmergencyPullError::RecipientMismatch(requested_recipient));
    }
    if amount_q64 == 0 {
        return Err(EmergencyPullError::ZeroAmount);
    }
    let proposal_id = compute_proposal_id(
        &entity.entity_id,
        &vault_id,
        amount_q64,
        &requested_recipient,
        &blackbox_record_hash,
    );
    Ok(EmergencyPullProposal {
        treasury_entity_id: entity.entity_id,
        vault_id,
        amount_q64,
        recipient: requested_recipient,
        blackbox_record_hash,
        proposal_id,
    })
}

fn compute_proposal_id(
    entity_id: &[u8; 32],
    vault_id: &Pubkey,
    amount: u128,
    recipient: &Pubkey,
    blackbox: &[u8; 32],
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.treasury.emergency.v1");
    h.update(entity_id);
    h.update(vault_id);
    h.update(&amount.to_le_bytes());
    h.update(recipient);
    h.update(blackbox);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::TreasuryRiskPolicy;
    use atlas_failure::class::ProtocolId;
    use atlas_governance::SignerSet;

    fn entity() -> TreasuryEntity {
        let policy = TreasuryRiskPolicy {
            max_exposure_per_protocol_bps: 5_000,
            approved_protocols: vec![ProtocolId(1)],
            min_idle_buffer_bps: 2_000,
            max_drawdown_bps_24h: 500,
            max_oracle_deviation_bps: 100,
            pause_signers_required: 2,
            rebalance_cooldown_slots: 9_000,
            emergency_recipient: [0xee; 32],
        };
        let board = SignerSet::new([[1u8; 32], [2u8; 32], [3u8; 32]], 2).unwrap();
        TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], policy, board).unwrap()
    }

    #[test]
    fn happy_path_produces_proposal() {
        let p = prepare_emergency_pull(&entity(), [7u8; 32], 1_000, [0xbb; 32], [0xee; 32]).unwrap();
        assert_eq!(p.amount_q64, 1_000);
        assert_eq!(p.recipient, [0xee; 32]);
        assert_eq!(p.blackbox_record_hash, [0xbb; 32]);
    }

    #[test]
    fn unowned_vault_rejects() {
        let r = prepare_emergency_pull(&entity(), [9u8; 32], 1_000, [0xbb; 32], [0xee; 32]);
        assert!(matches!(r, Err(EmergencyPullError::VaultNotOwned(_))));
    }

    #[test]
    fn wrong_recipient_rejects() {
        let r = prepare_emergency_pull(&entity(), [7u8; 32], 1_000, [0xbb; 32], [0xff; 32]);
        assert!(matches!(r, Err(EmergencyPullError::RecipientMismatch(_))));
    }

    #[test]
    fn zero_amount_rejects() {
        let r = prepare_emergency_pull(&entity(), [7u8; 32], 0, [0xbb; 32], [0xee; 32]);
        assert!(matches!(r, Err(EmergencyPullError::ZeroAmount)));
    }

    #[test]
    fn proposal_id_changes_when_amount_changes() {
        let a = prepare_emergency_pull(&entity(), [7u8; 32], 1_000, [0xbb; 32], [0xee; 32]).unwrap();
        let b = prepare_emergency_pull(&entity(), [7u8; 32], 2_000, [0xbb; 32], [0xee; 32]).unwrap();
        assert_ne!(a.proposal_id, b.proposal_id);
    }
}
