//! `BusinessTreasury` (directive §3.1) — extends the Phase 10
//! `TreasuryEntity` with KYB hash, payment account, and a role-bound
//! signer roster.

use crate::kyb::{KybAttestation, KybProviderId};
use atlas_runtime::Pubkey;
use atlas_treasury::TreasuryEntity;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Ceo,
    Cfo,
    Treasurer,
    Operator,
    ReadOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignerRosterEntry {
    pub pubkey: Pubkey,
    pub role: Role,
    pub single_payout_cap_q64: u128,
    pub daily_payout_cap_q64: u128,
    pub cooldown_slots: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignerRoster {
    pub entries: Vec<SignerRosterEntry>,
    /// Quorum required for any payout exceeding a signer's role cap.
    pub quorum_for_above_cap: u8,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BusinessKind {
    pub legal_name: String,
    pub kyb: KybAttestation,
    /// Stable Dodo account id. Used as the recipient of payouts and
    /// the source of the webhook signing key.
    pub payment_account_id: String,
    pub roster: SignerRoster,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BusinessTreasury {
    /// Reuse of Phase 10 `TreasuryEntity`. The business
    /// `commitment_hash` includes the inner entity hash plus the
    /// business-specific fields below.
    pub inner: TreasuryEntity,
    pub kind: BusinessKind,
    pub commitment_hash: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BusinessTreasuryError {
    #[error("legal_name must be non-empty")]
    EmptyLegalName,
    #[error("payment_account_id must be non-empty")]
    EmptyPaymentAccount,
    #[error("signer roster must have at least one Cfo or Treasurer entry")]
    MissingFinanceSigner,
    #[error("quorum_for_above_cap {got} > roster size {n}")]
    QuorumAboveRosterSize { got: u8, n: u32 },
    #[error("commitment hash mismatch: claimed={claimed:?}, computed={computed:?}")]
    CommitmentMismatch { claimed: [u8; 32], computed: [u8; 32] },
}

impl BusinessTreasury {
    pub fn new(
        inner: TreasuryEntity,
        kind: BusinessKind,
    ) -> Result<Self, BusinessTreasuryError> {
        if kind.legal_name.trim().is_empty() {
            return Err(BusinessTreasuryError::EmptyLegalName);
        }
        if kind.payment_account_id.trim().is_empty() {
            return Err(BusinessTreasuryError::EmptyPaymentAccount);
        }
        if !kind.roster.entries.iter().any(|e| matches!(e.role, Role::Cfo | Role::Treasurer)) {
            return Err(BusinessTreasuryError::MissingFinanceSigner);
        }
        let n = kind.roster.entries.len() as u32;
        if (kind.roster.quorum_for_above_cap as u32) > n {
            return Err(BusinessTreasuryError::QuorumAboveRosterSize {
                got: kind.roster.quorum_for_above_cap,
                n,
            });
        }
        let commitment_hash = business_commitment_hash(&inner, &kind);
        Ok(Self { inner, kind, commitment_hash })
    }

    pub fn validate(&self) -> Result<(), BusinessTreasuryError> {
        let computed = business_commitment_hash(&self.inner, &self.kind);
        if computed != self.commitment_hash {
            return Err(BusinessTreasuryError::CommitmentMismatch {
                claimed: self.commitment_hash,
                computed,
            });
        }
        Ok(())
    }

    /// True if a single signer can authorise a payout of `amount_q64`
    /// without invoking the multisig quorum.
    pub fn signer_can_solo_authorize(
        &self,
        signer: &Pubkey,
        amount_q64: u128,
    ) -> bool {
        for entry in &self.kind.roster.entries {
            if &entry.pubkey == signer {
                return amount_q64 <= entry.single_payout_cap_q64;
            }
        }
        false
    }
}

/// `commitment_hash = blake3("atlas.business.v1" ||
///   inner.commitment_hash || canonical business fields)`.
pub fn business_commitment_hash(inner: &TreasuryEntity, kind: &BusinessKind) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.business.v1");
    h.update(&inner.commitment_hash);
    h.update(kind.legal_name.as_bytes());
    h.update(&[0u8]);
    h.update(&[kind.kyb.provider as u8]);
    h.update(&kind.kyb.attestation_hash);
    h.update(&kind.kyb.provider_signer);
    h.update(kind.payment_account_id.as_bytes());
    h.update(&[0u8]);
    h.update(&(kind.roster.entries.len() as u32).to_le_bytes());
    let mut sorted = kind.roster.entries.clone();
    sorted.sort_by_key(|e| e.pubkey);
    for e in &sorted {
        h.update(&e.pubkey);
        h.update(&[e.role as u8]);
        h.update(&e.single_payout_cap_q64.to_le_bytes());
        h.update(&e.daily_payout_cap_q64.to_le_bytes());
        h.update(&e.cooldown_slots.to_le_bytes());
    }
    h.update(&[kind.roster.quorum_for_above_cap]);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_failure::class::ProtocolId;
    use atlas_governance::SignerSet;
    use atlas_treasury::TreasuryRiskPolicy;

    fn entity() -> TreasuryEntity {
        let policy = TreasuryRiskPolicy {
            max_exposure_per_protocol_bps: 5_000,
            approved_protocols: vec![ProtocolId(1)],
            min_idle_buffer_bps: 2_000,
            max_drawdown_bps_24h: 500,
            max_oracle_deviation_bps: 100,
            pause_signers_required: 2,
            rebalance_cooldown_slots: 9_000,
            emergency_recipient: [9u8; 32],
        };
        let board = SignerSet::new([[1u8; 32], [2u8; 32], [3u8; 32]], 2).unwrap();
        TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], policy, board).unwrap()
    }

    fn kyb() -> KybAttestation {
        KybAttestation {
            provider: KybProviderId::Dodo,
            payload_uri: "s3://kyb/abc".into(),
            attestation_hash: [1u8; 32],
            provider_signer: [9u8; 32],
        }
    }

    fn roster() -> SignerRoster {
        SignerRoster {
            entries: vec![
                SignerRosterEntry {
                    pubkey: [1u8; 32],
                    role: Role::Ceo,
                    single_payout_cap_q64: 10_000,
                    daily_payout_cap_q64: 100_000,
                    cooldown_slots: 1000,
                },
                SignerRosterEntry {
                    pubkey: [2u8; 32],
                    role: Role::Cfo,
                    single_payout_cap_q64: 50_000,
                    daily_payout_cap_q64: 500_000,
                    cooldown_slots: 0,
                },
            ],
            quorum_for_above_cap: 2,
        }
    }

    fn kind() -> BusinessKind {
        BusinessKind {
            legal_name: "Acme Internet Co".into(),
            kyb: kyb(),
            payment_account_id: "dodo_acct_123".into(),
            roster: roster(),
        }
    }

    #[test]
    fn happy_path_constructs() {
        let bt = BusinessTreasury::new(entity(), kind()).unwrap();
        bt.validate().unwrap();
    }

    #[test]
    fn empty_legal_name_rejects() {
        let mut k = kind();
        k.legal_name = "  ".into();
        let r = BusinessTreasury::new(entity(), k);
        assert!(matches!(r, Err(BusinessTreasuryError::EmptyLegalName)));
    }

    #[test]
    fn missing_finance_signer_rejects() {
        let mut k = kind();
        for e in k.roster.entries.iter_mut() {
            if matches!(e.role, Role::Cfo | Role::Treasurer) {
                e.role = Role::Operator;
            }
        }
        let r = BusinessTreasury::new(entity(), k);
        assert!(matches!(r, Err(BusinessTreasuryError::MissingFinanceSigner)));
    }

    #[test]
    fn quorum_above_roster_rejects() {
        let mut k = kind();
        k.roster.quorum_for_above_cap = 99;
        let r = BusinessTreasury::new(entity(), k);
        assert!(matches!(r, Err(BusinessTreasuryError::QuorumAboveRosterSize { .. })));
    }

    #[test]
    fn commitment_changes_when_roster_changes() {
        let a = BusinessTreasury::new(entity(), kind()).unwrap();
        let mut k = kind();
        k.roster.entries[0].single_payout_cap_q64 = 99_999;
        let b = BusinessTreasury::new(entity(), k).unwrap();
        assert_ne!(a.commitment_hash, b.commitment_hash);
    }

    #[test]
    fn solo_authorize_respects_role_cap() {
        let bt = BusinessTreasury::new(entity(), kind()).unwrap();
        // CEO cap is 10_000.
        assert!(bt.signer_can_solo_authorize(&[1u8; 32], 5_000));
        assert!(!bt.signer_can_solo_authorize(&[1u8; 32], 50_000));
        // CFO cap is 50_000.
        assert!(bt.signer_can_solo_authorize(&[2u8; 32], 30_000));
        // Unknown signer can't authorize at all.
        assert!(!bt.signer_can_solo_authorize(&[7u8; 32], 1));
    }
}
