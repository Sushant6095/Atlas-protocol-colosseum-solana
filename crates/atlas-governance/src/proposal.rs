//! Approval proposals.
//!
//! Each registry status transition flows through an `ApprovalProposal`.
//! The proposal carries the (model_id, prev_status, new_status, slot)
//! tuple — exactly what the Bubblegum anchor leaf will commit to. Voters
//! call [`ApprovalProposal::register_signer`] once per signer; the
//! orchestrator (or on-chain program) submits the proposal once the
//! threshold is reached via [`ApprovalProposal::submit`].

use crate::signer_set::{Pubkey, SignerSet};
use atlas_registry::record::{ModelId, ModelStatus};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ProposalError {
    #[error("signer {0:?} is not in the registered signer set")]
    UnknownSigner(Pubkey),
    #[error("threshold {threshold} not yet reached: {got} of {n} signed")]
    ThresholdNotReached { threshold: u32, got: u32, n: u32 },
    #[error("proposal already finalized — register a new proposal for the next transition")]
    AlreadyFinalized,
    #[error("transition {from:?} -> {to:?} is illegal at the registry layer")]
    IllegalTransition { from: Option<ModelStatus>, to: ModelStatus },
}

/// `proposal_id = blake3("atlas.gov.proposal.v1" || model_id ||
///   prev_status_byte || new_status_byte || slot_le)`. Stable identifier
/// matching the Bubblegum leaf the registry writes on submission.
pub fn proposal_id(
    model_id: &ModelId,
    prev_status: Option<ModelStatus>,
    new_status: ModelStatus,
    slot: u64,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.gov.proposal.v1");
    h.update(model_id);
    h.update(&[status_byte(prev_status)]);
    h.update(&[status_byte(Some(new_status))]);
    h.update(&slot.to_le_bytes());
    *h.finalize().as_bytes()
}

fn status_byte(s: Option<ModelStatus>) -> u8 {
    match s {
        Some(ModelStatus::Draft) => 1,
        Some(ModelStatus::Audited) => 2,
        Some(ModelStatus::Approved) => 3,
        Some(ModelStatus::DriftFlagged) => 4,
        Some(ModelStatus::Deprecated) => 5,
        Some(ModelStatus::Slashed) => 6,
        None => 0,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApprovalDecision {
    /// Threshold not yet reached.
    Pending,
    /// Threshold reached; the proposal is ready to submit.
    Ready,
    /// `submit()` already returned a `ProposalSubmission` for this proposal.
    Finalized,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ApprovalProposal {
    pub proposal_id: [u8; 32],
    pub model_id: ModelId,
    pub prev_status: Option<ModelStatus>,
    pub new_status: ModelStatus,
    pub slot: u64,
    pub signer_set: SignerSet,
    pub signers: BTreeSet<Pubkey>,
    pub decision: ApprovalDecision,
}

impl ApprovalProposal {
    pub fn new(
        model_id: ModelId,
        prev_status: Option<ModelStatus>,
        new_status: ModelStatus,
        slot: u64,
        signer_set: SignerSet,
    ) -> Self {
        let id = proposal_id(&model_id, prev_status, new_status, slot);
        Self {
            proposal_id: id,
            model_id,
            prev_status,
            new_status,
            slot,
            signer_set,
            signers: BTreeSet::new(),
            decision: ApprovalDecision::Pending,
        }
    }

    /// Record one signer. The orchestrator MUST verify the signer's
    /// ed25519 signature over `proposal_id` before calling this — this
    /// crate is signature-shape only. Idempotent on the same pubkey.
    pub fn register_signer(&mut self, signer: Pubkey) -> Result<(), ProposalError> {
        if self.decision == ApprovalDecision::Finalized {
            return Err(ProposalError::AlreadyFinalized);
        }
        if !self.signer_set.contains(&signer) {
            return Err(ProposalError::UnknownSigner(signer));
        }
        self.signers.insert(signer);
        if (self.signers.len() as u32) >= self.signer_set.threshold {
            self.decision = ApprovalDecision::Ready;
        }
        Ok(())
    }

    /// Finalize the proposal. Returns a `ProposalSubmission` carrying
    /// the proposal id + the signer-set root the registry should record
    /// alongside the Bubblegum anchor.
    pub fn submit(&mut self) -> Result<ProposalSubmission, ProposalError> {
        if self.decision == ApprovalDecision::Finalized {
            return Err(ProposalError::AlreadyFinalized);
        }
        let n = self.signer_set.pubkeys.len() as u32;
        let got = self.signers.len() as u32;
        if got < self.signer_set.threshold {
            return Err(ProposalError::ThresholdNotReached {
                threshold: self.signer_set.threshold,
                got,
                n,
            });
        }
        self.decision = ApprovalDecision::Finalized;
        Ok(ProposalSubmission {
            proposal_id: self.proposal_id,
            model_id: self.model_id,
            prev_status: self.prev_status,
            new_status: self.new_status,
            slot: self.slot,
            signer_set_root: self.signer_set.root(),
            signers: self.signers.iter().copied().collect(),
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProposalSubmission {
    pub proposal_id: [u8; 32],
    pub model_id: ModelId,
    pub prev_status: Option<ModelStatus>,
    pub new_status: ModelStatus,
    pub slot: u64,
    pub signer_set_root: [u8; 32],
    pub signers: Vec<Pubkey>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(b: u8) -> Pubkey { [b; 32] }

    fn proposal() -> ApprovalProposal {
        let signers = SignerSet::new([k(1), k(2), k(3), k(4), k(5)], 3).unwrap();
        ApprovalProposal::new([7u8; 32], Some(ModelStatus::Audited), ModelStatus::Approved, 100, signers)
    }

    #[test]
    fn proposal_id_is_deterministic() {
        let a = proposal_id(&[1u8; 32], Some(ModelStatus::Draft), ModelStatus::Audited, 100);
        let b = proposal_id(&[1u8; 32], Some(ModelStatus::Draft), ModelStatus::Audited, 100);
        assert_eq!(a, b);
        let c = proposal_id(&[1u8; 32], Some(ModelStatus::Draft), ModelStatus::Audited, 101);
        assert_ne!(a, c);
    }

    #[test]
    fn pending_until_threshold_reached() {
        let mut p = proposal();
        assert_eq!(p.decision, ApprovalDecision::Pending);
        p.register_signer(k(1)).unwrap();
        p.register_signer(k(2)).unwrap();
        assert_eq!(p.decision, ApprovalDecision::Pending);
        p.register_signer(k(3)).unwrap();
        assert_eq!(p.decision, ApprovalDecision::Ready);
    }

    #[test]
    fn duplicate_signer_is_idempotent() {
        let mut p = proposal();
        p.register_signer(k(1)).unwrap();
        p.register_signer(k(1)).unwrap();
        assert_eq!(p.signers.len(), 1);
    }

    #[test]
    fn unknown_signer_rejects() {
        let mut p = proposal();
        assert!(matches!(
            p.register_signer(k(99)),
            Err(ProposalError::UnknownSigner(_))
        ));
    }

    #[test]
    fn submit_below_threshold_rejects() {
        let mut p = proposal();
        p.register_signer(k(1)).unwrap();
        assert!(matches!(
            p.submit(),
            Err(ProposalError::ThresholdNotReached { .. })
        ));
    }

    #[test]
    fn submit_at_threshold_emits_submission_with_root() {
        let mut p = proposal();
        p.register_signer(k(1)).unwrap();
        p.register_signer(k(2)).unwrap();
        p.register_signer(k(3)).unwrap();
        let sub = p.submit().unwrap();
        assert_eq!(sub.signers.len(), 3);
        assert_eq!(sub.signer_set_root, p.signer_set.root());
        assert_eq!(p.decision, ApprovalDecision::Finalized);
    }

    #[test]
    fn finalized_blocks_further_signers_and_resubmit() {
        let mut p = proposal();
        for s in [k(1), k(2), k(3)] {
            p.register_signer(s).unwrap();
        }
        p.submit().unwrap();
        assert!(matches!(
            p.register_signer(k(4)),
            Err(ProposalError::AlreadyFinalized)
        ));
        assert!(matches!(p.submit(), Err(ProposalError::AlreadyFinalized)));
    }

    #[test]
    fn proposal_id_distinguishes_status_transitions() {
        let a = proposal_id(&[1u8; 32], Some(ModelStatus::Draft), ModelStatus::Audited, 100);
        let b = proposal_id(&[1u8; 32], Some(ModelStatus::Audited), ModelStatus::Approved, 100);
        assert_ne!(a, b);
    }
}
