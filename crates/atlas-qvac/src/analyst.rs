//! Local Second-Opinion Analyst (directive §5).
//!
//! Local LLM + RAG produces an independent natural-language review
//! of a pending Squads bundle. The approver still signs (or
//! doesn't) on their own judgment; the analyst is a check that
//! doesn't depend on Atlas's server being honest.
//!
//! Calibrated against the Phase 05 failure-class catalog. If the
//! model raises a concern outside that catalog, the UI flags it
//! as `unrecognized concern — escalate`.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalystRecommendation {
    Approve,
    Reject,
    Escalate,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnalystAssessment {
    pub recommendation: AnalystRecommendation,
    /// 0..=10_000 bps (so 10_000 = full confidence).
    pub confidence_bps: u32,
    pub concerns: Vec<String>,
    pub comparison_to_last_30d: String,
    pub fields_to_double_check: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnalystSummary {
    pub assessment: AnalystAssessment,
    /// Concerns the analyst raised that are not in the failure-class
    /// catalog. UI surfaces these as "unrecognized concern —
    /// escalate" so the approver doesn't auto-approve a flag the
    /// model invented.
    pub unrecognised_concerns: Vec<UnrecognisedConcern>,
    /// True iff `recommendation == Approve` AND
    /// `unrecognised_concerns.is_empty()`. The signing flow surfaces
    /// this as the "analyst clears" badge.
    pub clears_for_signing: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnrecognisedConcern {
    pub raw_text: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AnalystError {
    #[error("confidence_bps {0} exceeds 10_000")]
    ConfidenceOutOfRange(u32),
    #[error("recommendation {recommendation:?} but {concerns} concerns flagged — UI must surface as Escalate")]
    InconsistentRecommendation {
        recommendation: AnalystRecommendation,
        concerns: usize,
    },
}

/// Phase 05 §2.1 failure-class catalog. The analyst's free-form
/// concerns are matched against this list. Anything outside maps to
/// `UnrecognisedConcern`. Keep this list in sync with
/// `atlas_failure::class::FailureClass`.
pub const FAILURE_CLASS_CATALOG: &[&str] = &[
    "quorum_disagreement",
    "source_quarantined",
    "rpc_timeout",
    "stale_account",
    "oracle_stale",
    "oracle_deviation",
    "pyth_pull_post_failed",
    "agent_timeout",
    "hard_veto",
    "disagreement_over_threshold",
    "proof_gen_timeout",
    "proof_verify_failed",
    "proof_public_input_mismatch",
    "compute_exhaustion",
    "cpi_failure",
    "slippage_violation",
    "post_condition_violation",
    "bundle_not_landed",
    "alt_missing_account",
    "archival_write_failed",
    "bubblegum_anchor_lag",
    "stale_proof_replay_detected",
    "forged_vault_target",
    "manipulated_state_root",
    "per_session_expired",
    "settlement_verifier_reject",
    "per_operator_censorship",
    "per_settlement_replay",
];

pub fn validate_assessment(a: &AnalystAssessment) -> Result<(), AnalystError> {
    if a.confidence_bps > 10_000 {
        return Err(AnalystError::ConfidenceOutOfRange(a.confidence_bps));
    }
    if matches!(a.recommendation, AnalystRecommendation::Approve)
        && !a.concerns.is_empty()
    {
        return Err(AnalystError::InconsistentRecommendation {
            recommendation: a.recommendation,
            concerns: a.concerns.len(),
        });
    }
    Ok(())
}

/// Match concerns against the catalog and surface the rest as
/// unrecognised. `clears_for_signing` collapses to true only when
/// the recommendation is Approve and no concern is unrecognised.
pub fn summarise(assessment: AnalystAssessment) -> Result<AnalystSummary, AnalystError> {
    validate_assessment(&assessment)?;
    let mut unrecognised: Vec<UnrecognisedConcern> = Vec::new();
    for c in &assessment.concerns {
        if !concern_is_recognised(c) {
            unrecognised.push(UnrecognisedConcern { raw_text: c.clone() });
        }
    }
    let clears = matches!(assessment.recommendation, AnalystRecommendation::Approve)
        && unrecognised.is_empty();
    Ok(AnalystSummary {
        assessment,
        unrecognised_concerns: unrecognised,
        clears_for_signing: clears,
    })
}

fn concern_is_recognised(text: &str) -> bool {
    let lower = text.to_lowercase();
    FAILURE_CLASS_CATALOG.iter().any(|k| lower.contains(k))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approve() -> AnalystAssessment {
        AnalystAssessment {
            recommendation: AnalystRecommendation::Approve,
            confidence_bps: 9_200,
            concerns: vec![],
            comparison_to_last_30d: "consistent with last 30d allocation".into(),
            fields_to_double_check: vec!["projected_share_balance".into()],
        }
    }

    fn reject_with(concerns: Vec<&str>) -> AnalystAssessment {
        AnalystAssessment {
            recommendation: AnalystRecommendation::Reject,
            confidence_bps: 8_000,
            concerns: concerns.into_iter().map(String::from).collect(),
            comparison_to_last_30d: "diverges from 30d trend".into(),
            fields_to_double_check: vec!["fees_total_lamports".into()],
        }
    }

    #[test]
    fn approve_with_no_concerns_clears() {
        let s = summarise(approve()).unwrap();
        assert!(s.clears_for_signing);
        assert!(s.unrecognised_concerns.is_empty());
    }

    #[test]
    fn approve_with_concerns_inconsistent_rejected() {
        let mut a = approve();
        a.concerns.push("oracle_stale on USDC feed".into());
        let r = validate_assessment(&a);
        assert!(matches!(r, Err(AnalystError::InconsistentRecommendation { .. })));
    }

    #[test]
    fn reject_with_recognised_concern_does_not_clear() {
        let s = summarise(reject_with(vec!["slippage_violation breach"])).unwrap();
        assert!(!s.clears_for_signing);
        assert!(s.unrecognised_concerns.is_empty());
    }

    #[test]
    fn unrecognised_concern_surfaced() {
        let s = summarise(reject_with(vec!["something the model invented"])).unwrap();
        assert!(!s.clears_for_signing);
        assert_eq!(s.unrecognised_concerns.len(), 1);
        assert_eq!(s.unrecognised_concerns[0].raw_text, "something the model invented");
    }

    #[test]
    fn confidence_above_10000_rejected() {
        let mut a = approve();
        a.confidence_bps = 12_000;
        let r = validate_assessment(&a);
        assert!(matches!(r, Err(AnalystError::ConfidenceOutOfRange(_))));
    }

    #[test]
    fn catalog_includes_phase18_classes() {
        assert!(FAILURE_CLASS_CATALOG.contains(&"per_session_expired"));
        assert!(FAILURE_CLASS_CATALOG.contains(&"settlement_verifier_reject"));
    }

    #[test]
    fn concern_lowercase_match() {
        // Catalog matches case-insensitively.
        let s = summarise(reject_with(vec!["Cpi_Failure on Drift"])).unwrap();
        assert!(s.unrecognised_concerns.is_empty());
    }

    #[test]
    fn escalate_recommendation_with_unrecognised_concern() {
        let a = AnalystAssessment {
            recommendation: AnalystRecommendation::Escalate,
            confidence_bps: 4_000,
            concerns: vec!["stale_account on vault PDA".into(), "novel concern".into()],
            comparison_to_last_30d: "ambiguous".into(),
            fields_to_double_check: vec![],
        };
        let s = summarise(a).unwrap();
        assert_eq!(s.unrecognised_concerns.len(), 1);
        assert!(!s.clears_for_signing);
    }
}
