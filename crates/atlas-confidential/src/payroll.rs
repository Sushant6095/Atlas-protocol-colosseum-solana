//! Confidential payroll batches (directive §5).

use crate::commitment::{aggregate_commitments, AmountCommitment};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfidentialPayrollEntry {
    /// Recipient identifier hashed with the operator's salt — the
    /// recipient's pubkey is never stored on-chain in plaintext.
    pub recipient_ref_hash: [u8; 32],
    /// Pedersen / ElGamal commitment to the amount.
    pub amount_commitment: AmountCommitment,
    /// Mint of the underlying confidential balance.
    pub mint: Pubkey,
    /// Cleartext priority class — public; used by pre-warm planner.
    pub priority: PayrollPriority,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PayrollPriority {
    Standard,
    Critical,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfidentialPayrollBatch {
    pub batch_id: [u8; 32],
    pub treasury_id: Pubkey,
    pub entries: Vec<ConfidentialPayrollEntry>,
    /// Aggregate commitment over all entries — proved equal to the
    /// vault's pre-warm commitment growth in the rebalance proof.
    pub aggregate_commitment: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PayrollBatchError {
    #[error("payroll batch must have at least one entry")]
    Empty,
    #[error("aggregate commitment mismatch: claimed={claimed:?}, computed={computed:?}")]
    AggregateMismatch { claimed: [u8; 32], computed: [u8; 32] },
    #[error("duplicate recipient_ref_hash {0:?}")]
    DuplicateRecipient([u8; 32]),
}

impl ConfidentialPayrollBatch {
    pub fn new(
        treasury_id: Pubkey,
        entries: Vec<ConfidentialPayrollEntry>,
    ) -> Result<Self, PayrollBatchError> {
        if entries.is_empty() {
            return Err(PayrollBatchError::Empty);
        }
        let mut seen = std::collections::BTreeSet::new();
        for e in &entries {
            if !seen.insert(e.recipient_ref_hash) {
                return Err(PayrollBatchError::DuplicateRecipient(e.recipient_ref_hash));
            }
        }
        let commitments: Vec<AmountCommitment> =
            entries.iter().map(|e| e.amount_commitment).collect();
        let aggregate_commitment = aggregate_commitments(&commitments);
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.confidential.payroll.v1");
        h.update(&treasury_id);
        h.update(&aggregate_commitment);
        h.update(&(entries.len() as u32).to_le_bytes());
        let batch_id = *h.finalize().as_bytes();
        Ok(Self {
            batch_id,
            treasury_id,
            entries,
            aggregate_commitment,
        })
    }

    pub fn validate(&self) -> Result<(), PayrollBatchError> {
        let commitments: Vec<AmountCommitment> =
            self.entries.iter().map(|e| e.amount_commitment).collect();
        let computed = aggregate_commitments(&commitments);
        if computed != self.aggregate_commitment {
            return Err(PayrollBatchError::AggregateMismatch {
                claimed: self.aggregate_commitment,
                computed,
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(rec: u8, amt: u8) -> ConfidentialPayrollEntry {
        ConfidentialPayrollEntry {
            recipient_ref_hash: [rec; 32],
            amount_commitment: AmountCommitment { bytes: [amt; 32] },
            mint: [9u8; 32],
            priority: PayrollPriority::Standard,
        }
    }

    #[test]
    fn batch_aggregates_commitments() {
        let b = ConfidentialPayrollBatch::new(
            [1u8; 32],
            vec![entry(1, 10), entry(2, 20), entry(3, 30)],
        )
        .unwrap();
        assert_eq!(b.entries.len(), 3);
        b.validate().unwrap();
    }

    #[test]
    fn empty_batch_rejects() {
        let r = ConfidentialPayrollBatch::new([1u8; 32], vec![]);
        assert!(matches!(r, Err(PayrollBatchError::Empty)));
    }

    #[test]
    fn duplicate_recipient_rejects() {
        let r = ConfidentialPayrollBatch::new(
            [1u8; 32],
            vec![entry(1, 10), entry(1, 20)],
        );
        assert!(matches!(r, Err(PayrollBatchError::DuplicateRecipient(_))));
    }

    #[test]
    fn tampered_aggregate_fails_validation() {
        let mut b = ConfidentialPayrollBatch::new(
            [1u8; 32],
            vec![entry(1, 10), entry(2, 20)],
        )
        .unwrap();
        b.aggregate_commitment[0] ^= 0xff;
        let r = b.validate();
        assert!(matches!(r, Err(PayrollBatchError::AggregateMismatch { .. })));
    }

    #[test]
    fn batch_id_is_deterministic() {
        let a = ConfidentialPayrollBatch::new(
            [1u8; 32],
            vec![entry(1, 10), entry(2, 20)],
        )
        .unwrap();
        let b = ConfidentialPayrollBatch::new(
            [1u8; 32],
            vec![entry(1, 10), entry(2, 20)],
        )
        .unwrap();
        assert_eq!(a.batch_id, b.batch_id);
    }
}
