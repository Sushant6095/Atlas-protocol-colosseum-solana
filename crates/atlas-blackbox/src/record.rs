//! Black-box record schema (directive §3.1) + validation.
//!
//! Anti-pattern §7: *"Black box records that omit a field and substitute
//! null silently."* — the validator below enforces that every required
//! field is present and that `null` values appear only where the directive
//! permits them (after_state_hash and balances_after on abort).

use atlas_failure::FailureClass;
use serde::{Deserialize, Serialize};

pub const BLACKBOX_SCHEMA: &str = "atlas.blackbox.v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlackBoxStatus {
    Landed,
    Aborted,
    Rejected,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CpiTraceEntry {
    pub step: u32,
    pub program: String,
    pub ix: String,
    pub cu: u32,
    pub return_data_hash: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PostConditionResult {
    pub invariant: String,
    pub passed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Timings {
    pub ingest_ms: u32,
    pub infer_ms: u32,
    pub prove_ms: u32,
    pub submit_ms: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlackBoxRecord {
    pub schema: String,
    pub vault_id: [u8; 32],
    pub slot: u64,
    pub status: BlackBoxStatus,
    pub before_state_hash: [u8; 32],
    pub after_state_hash: Option<[u8; 32]>,
    pub balances_before: Vec<u128>,
    pub balances_after: Option<Vec<u128>>,
    pub feature_root: [u8; 32],
    pub consensus_root: [u8; 32],
    pub agent_proposals_uri: String,
    pub explanation_hash: [u8; 32],
    pub explanation_canonical_uri: String,
    pub risk_state_hash: [u8; 32],
    pub risk_topology_uri: String,
    pub public_input_hex: String,
    pub proof_uri: String,
    pub cpi_trace: Vec<CpiTraceEntry>,
    pub post_conditions: Vec<PostConditionResult>,
    pub failure_class: Option<FailureClass>,
    pub tx_signature: Option<Vec<u8>>,
    pub landed_slot: Option<u64>,
    pub bundle_id: [u8; 32],
    pub prover_id: [u8; 32],
    pub timings_ms: Timings,
    pub telemetry_span_id: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RecordValidationError {
    #[error("schema must equal `{expected}` (got `{got}`)")]
    BadSchema { expected: &'static str, got: String },
    #[error("status `landed` requires after_state_hash + balances_after")]
    LandedMissingAfter,
    #[error("status `aborted`/`rejected` must NOT carry after_state_hash")]
    AbortedHasAfter,
    #[error("status `landed` must have a tx_signature + landed_slot")]
    LandedMissingTx,
    #[error("status `landed` must NOT have a failure_class")]
    LandedHasFailure,
    #[error("status `aborted` or `rejected` must carry a failure_class")]
    AbortedNoFailure,
    #[error("public_input_hex must be 268*2 = 536 hex chars (got {0})")]
    PublicInputBadLength(usize),
    #[error("balances_before / balances_after must have equal length on landed status")]
    BalancesLengthMismatch,
    #[error("cpi_trace step indices must be 1-based monotonic")]
    CpiTraceStepsBroken,
    #[error("post_condition list contains a failed invariant: {0}")]
    PostConditionFailed(String),
}

impl BlackBoxRecord {
    /// Validate that the record satisfies every §3.1 invariant. The Phase 03
    /// write path refuses records that fail this check — anti-pattern §7
    /// enforced.
    pub fn validate(&self) -> Result<(), RecordValidationError> {
        if self.schema != BLACKBOX_SCHEMA {
            return Err(RecordValidationError::BadSchema {
                expected: BLACKBOX_SCHEMA,
                got: self.schema.clone(),
            });
        }
        if self.public_input_hex.len() != 268 * 2 {
            return Err(RecordValidationError::PublicInputBadLength(self.public_input_hex.len()));
        }
        for (i, e) in self.cpi_trace.iter().enumerate() {
            if e.step != (i as u32) + 1 {
                return Err(RecordValidationError::CpiTraceStepsBroken);
            }
        }

        match self.status {
            BlackBoxStatus::Landed => {
                if self.after_state_hash.is_none() || self.balances_after.is_none() {
                    return Err(RecordValidationError::LandedMissingAfter);
                }
                if self.tx_signature.is_none() || self.landed_slot.is_none() {
                    return Err(RecordValidationError::LandedMissingTx);
                }
                if self.failure_class.is_some() {
                    return Err(RecordValidationError::LandedHasFailure);
                }
                let after_len = self
                    .balances_after
                    .as_ref()
                    .map(|v| v.len())
                    .unwrap_or(0);
                if after_len != self.balances_before.len() {
                    return Err(RecordValidationError::BalancesLengthMismatch);
                }
            }
            BlackBoxStatus::Aborted | BlackBoxStatus::Rejected => {
                if self.after_state_hash.is_some() {
                    return Err(RecordValidationError::AbortedHasAfter);
                }
                if self.failure_class.is_none() {
                    return Err(RecordValidationError::AbortedNoFailure);
                }
            }
        }

        // Post-conditions: every invariant must have passed (Phase 01 §I-10).
        if let Some(failed) = self.post_conditions.iter().find(|p| !p.passed) {
            return Err(RecordValidationError::PostConditionFailed(failed.invariant.clone()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_failure::FailureClass;

    fn landed_record() -> BlackBoxRecord {
        BlackBoxRecord {
            schema: BLACKBOX_SCHEMA.into(),
            vault_id: [1u8; 32],
            slot: 100,
            status: BlackBoxStatus::Landed,
            before_state_hash: [2u8; 32],
            after_state_hash: Some([3u8; 32]),
            balances_before: vec![1_000, 2_000, 3_000],
            balances_after: Some(vec![1_500, 1_500, 3_000]),
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            agent_proposals_uri: "s3://atlas/proposals/abc".into(),
            explanation_hash: [6u8; 32],
            explanation_canonical_uri: "s3://atlas/explanations/abc".into(),
            risk_state_hash: [7u8; 32],
            risk_topology_uri: "s3://atlas/topology/abc".into(),
            public_input_hex: "00".repeat(268),
            proof_uri: "s3://atlas/proofs/abc".into(),
            cpi_trace: vec![
                CpiTraceEntry { step: 1, program: "Kamino".into(), ix: "Deposit".into(), cu: 80_000, return_data_hash: [0u8; 32] },
                CpiTraceEntry { step: 2, program: "Drift".into(), ix: "PerpDeposit".into(), cu: 120_000, return_data_hash: [0u8; 32] },
            ],
            post_conditions: vec![PostConditionResult { invariant: "kamino_delta".into(), passed: true }],
            failure_class: None,
            tx_signature: Some(vec![0u8; 64]),
            landed_slot: Some(101),
            bundle_id: [8u8; 32],
            prover_id: [9u8; 32],
            timings_ms: Timings { ingest_ms: 100, infer_ms: 50, prove_ms: 30_000, submit_ms: 1_000 },
            telemetry_span_id: "span-abc".into(),
        }
    }

    #[test]
    fn landed_record_validates() {
        landed_record().validate().unwrap();
    }

    #[test]
    fn landed_missing_after_rejects() {
        let mut r = landed_record();
        r.after_state_hash = None;
        assert!(matches!(r.validate(), Err(RecordValidationError::LandedMissingAfter)));
    }

    #[test]
    fn landed_missing_tx_rejects() {
        let mut r = landed_record();
        r.tx_signature = None;
        assert!(matches!(r.validate(), Err(RecordValidationError::LandedMissingTx)));
    }

    #[test]
    fn landed_with_failure_class_rejects() {
        let mut r = landed_record();
        r.failure_class = Some(FailureClass::ProofGenTimeout);
        assert!(matches!(r.validate(), Err(RecordValidationError::LandedHasFailure)));
    }

    #[test]
    fn aborted_without_failure_rejects() {
        let mut r = landed_record();
        r.status = BlackBoxStatus::Aborted;
        r.after_state_hash = None;
        r.balances_after = None;
        r.tx_signature = None;
        r.landed_slot = None;
        // failure_class still None → must reject.
        assert!(matches!(r.validate(), Err(RecordValidationError::AbortedNoFailure)));
    }

    #[test]
    fn aborted_with_failure_validates() {
        let mut r = landed_record();
        r.status = BlackBoxStatus::Aborted;
        r.after_state_hash = None;
        r.balances_after = None;
        r.tx_signature = None;
        r.landed_slot = None;
        r.failure_class = Some(FailureClass::ProofGenTimeout);
        r.validate().unwrap();
    }

    #[test]
    fn balances_length_mismatch_rejects() {
        let mut r = landed_record();
        r.balances_after = Some(vec![1, 2]); // mismatched length
        assert!(matches!(r.validate(), Err(RecordValidationError::BalancesLengthMismatch)));
    }

    #[test]
    fn cpi_trace_step_must_be_monotonic_one_based() {
        let mut r = landed_record();
        r.cpi_trace[0].step = 99;
        assert!(matches!(r.validate(), Err(RecordValidationError::CpiTraceStepsBroken)));
    }

    #[test]
    fn failed_invariant_rejects() {
        let mut r = landed_record();
        r.post_conditions
            .push(PostConditionResult { invariant: "kamino_no_drift".into(), passed: false });
        assert!(matches!(r.validate(), Err(RecordValidationError::PostConditionFailed(_))));
    }

    #[test]
    fn schema_mismatch_rejects() {
        let mut r = landed_record();
        r.schema = "atlas.blackbox.v0".into();
        assert!(matches!(r.validate(), Err(RecordValidationError::BadSchema { .. })));
    }

    #[test]
    fn public_input_bad_length_rejects() {
        let mut r = landed_record();
        r.public_input_hex = "00".into();
        assert!(matches!(r.validate(), Err(RecordValidationError::PublicInputBadLength(_))));
    }
}
