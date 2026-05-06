//! atlas-confidential — Atlas Confidential Treasury Layer
//! (directive 14).
//!
//! **Principle:** public verifiability of behavior, confidentiality of
//! amounts. Anyone can verify Atlas followed its strategy commitment,
//! produced a valid Groth16 proof, moved capital according to proven
//! allocation ratios, and did not violate any invariant — without
//! learning treasury size, per-protocol notionals, payroll
//! recipients, or vendor settlement amounts. Auditors / regulators
//! / signers see what they need via viewing keys (selective
//! disclosure).
//!
//! Eight modules:
//!
//! * `surface`        — public/confidential field classification
//!                      (§2 authoritative table); construction-time
//!                      gate refusing to mark a §2 confidential field
//!                      as public.
//! * `pattern`        — Token-2022 ConfidentialTransfer (Pattern A)
//!                      + Cloak shielded wrapper (Pattern B). One per
//!                      vault; immutable post-creation (I-16).
//! * `commitment`     — Pedersen / ElGamal homomorphic commitment
//!                      shapes + range-proof contract.
//! * `public_input_v3`— 300-byte v3 layout adding `confidential_mode`
//!                      flag + `disclosure_policy_hash`. Verifier
//!                      accepts both v2 (Phase 01) and v3.
//! * `disclosure`     — `DisclosurePolicy` + `DisclosureRole` +
//!                      `DisclosureScope` + viewing-key issuance,
//!                      rotation, revocation.
//! * `payroll`        — confidential payroll batches (encrypted
//!                      amounts + recipients) settled via Cloak.
//! * `audit_log`      — Bubblegum-anchored disclosure event log
//!                      (I-17 enforcement).
//! * `compliance`     — AML clearance attestation + travel-rule
//!                      payload hash (above-threshold flow).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod audit_log;
pub mod commitment;
pub mod compliance;
pub mod disclosure;
pub mod pattern;
pub mod payroll;
pub mod public_input_v3;
pub mod surface;

pub use audit_log::{
    DisclosureEvent, DisclosureLog, DisclosureLogError, DisclosureReason,
    DISCLOSURE_LOG_DOMAIN,
};
pub use commitment::{
    aggregate_commitments, verify_range_proof, AmountCommitment, CommitmentError,
    PedersenBlinding, RangeProof, RANGE_PROOF_DOMAIN,
};
pub use compliance::{
    AmlClearance, AmlClearanceError, TravelRulePayloadRef, TRAVEL_RULE_THRESHOLD_USD_Q64,
};
pub use disclosure::{
    issue_viewing_key, revoke_viewing_key, validate_viewing_key, DisclosurePolicy,
    DisclosurePolicyEntry, DisclosureRole, DisclosureScope, DisclosurePolicyError,
    ViewingKey, ViewingKeyError, ViewingKeyKind, ViewingKeyStatus,
};
pub use pattern::{ConfidentialPattern, PatternMismatchError};
pub use payroll::{
    ConfidentialPayrollBatch, ConfidentialPayrollEntry, PayrollBatchError,
};
pub use public_input_v3::{
    encode_v3, ConfidentialFlags, PublicInputV3, V3_TOTAL_BYTES, V3_VERSION_TAG,
};
pub use surface::{classify_field, FieldVisibility, SurfaceClassificationError, FieldName};
