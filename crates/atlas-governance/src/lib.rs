//! atlas-governance — multisig approval flow for the model registry
//! (directive 06 §3.1).
//!
//! Squads-compatible by shape: signer set is a sorted set of pubkeys
//! merkleized into a `signer_set_root`; an `ApprovalProposal` is a
//! `(model_id, prev_status, new_status, slot)` tuple plus a
//! `BTreeSet<Pubkey>` of signers; submission is gated on
//! `signers.len() >= threshold`.
//!
//! This crate is signature-shape: it doesn't verify ed25519 itself, it
//! works on the assumption that the orchestrator (or the on-chain
//! program) has already verified each `(pubkey, signature)` pair before
//! calling `register_signer`. Verification is the trust boundary; this
//! crate enforces threshold + signer-set membership + replay protection
//! on top.
//!
//! Replay protection: every proposal is keyed by
//! `proposal_id = blake3("atlas.gov.proposal.v1" || model_id ||
//!  prev_status_byte || new_status_byte || slot_le)`. Approving a
//! proposal twice is a no-op; submitting a proposal whose `slot` is
//! older than the registry's last on-chain anchor for that model is
//! rejected.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod proposal;
pub mod signer_set;

pub use proposal::{
    proposal_id, ApprovalDecision, ApprovalProposal, ProposalError, ProposalSubmission,
};
pub use signer_set::{signer_set_root, SignerSet, SignerSetError};
