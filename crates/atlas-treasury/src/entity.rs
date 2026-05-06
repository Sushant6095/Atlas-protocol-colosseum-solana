//! `TreasuryEntity` (directive §3.1).

use crate::policy::{policy_commitment_hash, PolicyError, TreasuryRiskPolicy};
use atlas_governance::SignerSet;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TreasuryEntity {
    pub entity_id: [u8; 32],
    /// Address of the Squads-compatible multisig that admins this
    /// treasury.
    pub multisig_address: Pubkey,
    /// One or more vault ids owned by the treasury. PUSD-native by
    /// default per §3.1.
    pub owned_vaults: Vec<Pubkey>,
    pub risk_policy: TreasuryRiskPolicy,
    /// Approved signer board (Squads members + threshold).
    pub board: SignerSet,
    /// `commitment_hash = blake3("atlas.treasury.entity.v1" || ...)`.
    pub commitment_hash: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TreasuryEntityError {
    #[error("policy: {0}")]
    Policy(#[from] PolicyError),
    #[error("at least one vault required")]
    NoVaults,
    #[error("multisig threshold {threshold} > pause_signers_required {required}")]
    ThresholdMismatch { threshold: u32, required: u8 },
    #[error("commitment hash mismatch: claimed={claimed:?}, computed={computed:?}")]
    CommitmentMismatch { claimed: [u8; 32], computed: [u8; 32] },
}

impl TreasuryEntity {
    pub fn new(
        multisig_address: Pubkey,
        owned_vaults: Vec<Pubkey>,
        risk_policy: TreasuryRiskPolicy,
        board: SignerSet,
    ) -> Result<Self, TreasuryEntityError> {
        risk_policy.validate()?;
        if owned_vaults.is_empty() {
            return Err(TreasuryEntityError::NoVaults);
        }
        if board.threshold < risk_policy.pause_signers_required as u32 {
            return Err(TreasuryEntityError::ThresholdMismatch {
                threshold: board.threshold,
                required: risk_policy.pause_signers_required,
            });
        }
        let commitment_hash = compute_commitment(
            &multisig_address,
            &owned_vaults,
            &risk_policy,
            &board,
        );
        let entity_id = commitment_hash;
        Ok(Self {
            entity_id,
            multisig_address,
            owned_vaults,
            risk_policy,
            board,
            commitment_hash,
        })
    }

    pub fn validate(&self) -> Result<(), TreasuryEntityError> {
        self.risk_policy.validate()?;
        if self.owned_vaults.is_empty() {
            return Err(TreasuryEntityError::NoVaults);
        }
        let computed = compute_commitment(
            &self.multisig_address,
            &self.owned_vaults,
            &self.risk_policy,
            &self.board,
        );
        if computed != self.commitment_hash {
            return Err(TreasuryEntityError::CommitmentMismatch {
                claimed: self.commitment_hash,
                computed,
            });
        }
        Ok(())
    }
}

fn compute_commitment(
    multisig: &Pubkey,
    vaults: &[Pubkey],
    policy: &TreasuryRiskPolicy,
    board: &SignerSet,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.treasury.entity.v1");
    h.update(multisig);
    let mut sorted_vaults = vaults.to_vec();
    sorted_vaults.sort();
    for v in &sorted_vaults {
        h.update(v);
    }
    h.update(&policy_commitment_hash(policy));
    h.update(&board.root());
    h.update(&board.threshold.to_le_bytes());
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_failure::class::ProtocolId;

    fn policy() -> TreasuryRiskPolicy {
        TreasuryRiskPolicy {
            max_exposure_per_protocol_bps: 5_000,
            approved_protocols: vec![ProtocolId(1)],
            min_idle_buffer_bps: 2_000,
            max_drawdown_bps_24h: 500,
            max_oracle_deviation_bps: 100,
            pause_signers_required: 2,
            rebalance_cooldown_slots: 9_000,
            emergency_recipient: [9u8; 32],
        }
    }

    fn board() -> SignerSet {
        SignerSet::new([[1u8; 32], [2u8; 32], [3u8; 32]], 2).unwrap()
    }

    #[test]
    fn good_entity_validates() {
        let e = TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], policy(), board()).unwrap();
        e.validate().unwrap();
    }

    #[test]
    fn no_vaults_rejects() {
        assert!(matches!(
            TreasuryEntity::new([0xab; 32], vec![], policy(), board()),
            Err(TreasuryEntityError::NoVaults)
        ));
    }

    #[test]
    fn threshold_below_pause_signers_rejects() {
        let mut p = policy();
        p.pause_signers_required = 5; // board threshold is 2
        assert!(matches!(
            TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], p, board()),
            Err(TreasuryEntityError::ThresholdMismatch { .. })
        ));
    }

    #[test]
    fn entity_id_changes_when_policy_changes() {
        let a = TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], policy(), board()).unwrap();
        let mut p = policy();
        p.max_drawdown_bps_24h = 1_000;
        let b = TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], p, board()).unwrap();
        assert_ne!(a.entity_id, b.entity_id);
    }
}
