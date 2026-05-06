//! Remediation policy — directive §2.2.
//!
//! `remediation_for(class) -> Remediation` is `const fn` and exhaustive
//! over `FailureClass`; the Rust compiler enforces that every new variant
//! must declare its remediation, satisfying the directive's requirement
//! for compile-time exhaustiveness.

use crate::class::FailureClass;

/// Stable string id used in warehouse logs (Phase 03 `failure_classifications.remediation_id`).
pub type RemediationId = &'static str;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Remediation {
    /// Halt rebalance and page oncall — funds-at-risk class.
    HaltAndPage(RemediationId),
    /// Failover the source from hot → warm and retry.
    FailoverAndRetry(RemediationId),
    /// Post a fresh Pyth update; if that fails, defensive mode.
    PostPythThenDefensive(RemediationId),
    /// Switch to defensive vector for this rebalance.
    Defensive(RemediationId),
    /// Exclude the agent (degraded ensemble) and retry. If 2+ agents are out, halt.
    ExcludeAgentRetry(RemediationId),
    /// Use the pre-committed defensive vector and proceed (hard-veto path).
    DefensiveVectorProceed(RemediationId),
    /// Fall back to the backup prover; halt if all provers fail.
    FallbackProverElseHalt(RemediationId),
    /// Refresh the CU model, segment the tx, retry.
    RefreshCuSegmentRetry(RemediationId),
    /// Atomic revert; retry once with refreshed accounts.
    RevertAndRetryOnce(RemediationId),
    /// Atomic revert; allocation narrowed; retry.
    RevertNarrowAndRetry(RemediationId),
    /// Atomic revert; do not retry; page oncall.
    RevertNoRetryPage(RemediationId),
    /// Retry with higher tip up to a cap; then defensive.
    RetryHigherTipElseDefensive(RemediationId),
    /// Reject the tx and emit a security event.
    RejectAndSecurityEvent(RemediationId),
    /// Abort bundle submission and page oncall (archival contract violation).
    AbortAndPage(RemediationId),
    /// Reject as invalid and short-circuit. No retry.
    RejectInvalid(RemediationId),
}

impl Remediation {
    pub const fn id(self) -> RemediationId {
        match self {
            Remediation::HaltAndPage(id) => id,
            Remediation::FailoverAndRetry(id) => id,
            Remediation::PostPythThenDefensive(id) => id,
            Remediation::Defensive(id) => id,
            Remediation::ExcludeAgentRetry(id) => id,
            Remediation::DefensiveVectorProceed(id) => id,
            Remediation::FallbackProverElseHalt(id) => id,
            Remediation::RefreshCuSegmentRetry(id) => id,
            Remediation::RevertAndRetryOnce(id) => id,
            Remediation::RevertNarrowAndRetry(id) => id,
            Remediation::RevertNoRetryPage(id) => id,
            Remediation::RetryHigherTipElseDefensive(id) => id,
            Remediation::RejectAndSecurityEvent(id) => id,
            Remediation::AbortAndPage(id) => id,
            Remediation::RejectInvalid(id) => id,
        }
    }
}

/// Compile-time exhaustive remediation map. Adding a `FailureClass` variant
/// without updating this match is a compile error.
pub const fn remediation_for(class: &FailureClass) -> Remediation {
    match class {
        // Ingestion
        FailureClass::QuorumDisagreement { hard: true } => Remediation::HaltAndPage("rem.quorum.hard.halt"),
        FailureClass::QuorumDisagreement { hard: false } => Remediation::Defensive("rem.quorum.soft.defensive"),
        FailureClass::SourceQuarantined { .. } => Remediation::FailoverAndRetry("rem.source.quarantined.failover"),
        FailureClass::RpcTimeout { .. } => Remediation::FailoverAndRetry("rem.rpc.timeout.failover"),
        FailureClass::StaleAccount { .. } => Remediation::FailoverAndRetry("rem.account.stale.failover"),

        // Oracle
        FailureClass::OracleStale { .. } => Remediation::PostPythThenDefensive("rem.oracle.stale.repost"),
        FailureClass::OracleDeviation { .. } => Remediation::Defensive("rem.oracle.deviation.defensive"),
        FailureClass::PythPullPostFailed => Remediation::AbortAndPage("rem.pyth.post.failed"),

        // Inference / Consensus
        FailureClass::AgentTimeout { .. } => Remediation::ExcludeAgentRetry("rem.agent.timeout.exclude"),
        FailureClass::HardVeto { .. } => Remediation::DefensiveVectorProceed("rem.agent.hardveto.defensive"),
        FailureClass::DisagreementOverThreshold { .. } => Remediation::Defensive("rem.consensus.disagree.defensive"),

        // Proof
        FailureClass::ProofGenTimeout => Remediation::FallbackProverElseHalt("rem.proof.gen.timeout.fallback"),
        FailureClass::ProofVerifyFailed => Remediation::RejectInvalid("rem.proof.verify.failed.reject"),
        FailureClass::ProofPublicInputMismatch => Remediation::RejectInvalid("rem.proof.public_input.mismatch.reject"),

        // Execution
        FailureClass::ComputeExhaustion { .. } => Remediation::RefreshCuSegmentRetry("rem.cu.exhaustion.segment"),
        FailureClass::CpiFailure { .. } => Remediation::RevertAndRetryOnce("rem.cpi.failure.retry_once"),
        FailureClass::SlippageViolation { .. } => Remediation::RevertNarrowAndRetry("rem.slippage.violation.narrow"),
        FailureClass::PostConditionViolation { .. } => Remediation::RevertNoRetryPage("rem.postcondition.violation.page"),
        FailureClass::BundleNotLanded { .. } => Remediation::RetryHigherTipElseDefensive("rem.bundle.not_landed.retry_tip"),
        FailureClass::AltMissingAccount { .. } => Remediation::FailoverAndRetry("rem.alt.missing.failover"),

        // Archival
        FailureClass::ArchivalWriteFailed => Remediation::AbortAndPage("rem.archival.failed.abort"),
        FailureClass::BubblegumAnchorLag => Remediation::HaltAndPage("rem.bubblegum.lag.halt"),

        // Adversarial
        FailureClass::StaleProofReplayDetected => Remediation::RejectAndSecurityEvent("rem.security.stale_proof_replay"),
        FailureClass::ForgedVaultTarget => Remediation::RejectAndSecurityEvent("rem.security.forged_vault"),
        FailureClass::ManipulatedStateRoot => Remediation::RejectAndSecurityEvent("rem.security.state_root_manip"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::class::{AgentId, AssetId, FeedId, ProtocolId, RejectionCode, SourceId};

    #[test]
    fn every_variant_maps_to_a_remediation() {
        let all: Vec<FailureClass> = vec![
            FailureClass::QuorumDisagreement { hard: true },
            FailureClass::QuorumDisagreement { hard: false },
            FailureClass::SourceQuarantined { source: SourceId(1) },
            FailureClass::RpcTimeout { source: SourceId(1) },
            FailureClass::StaleAccount { pubkey: [0u8; 32], lag_slots: 100 },
            FailureClass::OracleStale { feed_id: FeedId(1), lag_slots: 30 },
            FailureClass::OracleDeviation { asset: AssetId(1), deviation_bps: 200 },
            FailureClass::PythPullPostFailed,
            FailureClass::AgentTimeout { agent_id: AgentId::TailRisk },
            FailureClass::HardVeto { agent_id: AgentId::TailRisk, reason: RejectionCode::TailRiskBreach },
            FailureClass::DisagreementOverThreshold { score_bps: 4_000 },
            FailureClass::ProofGenTimeout,
            FailureClass::ProofVerifyFailed,
            FailureClass::ProofPublicInputMismatch,
            FailureClass::ComputeExhaustion { predicted_cu: 1_000_000, used_cu: 1_500_000 },
            FailureClass::CpiFailure { protocol: ProtocolId(1), error_code: 7 },
            FailureClass::SlippageViolation { expected_bps: 50, observed_bps: 250 },
            FailureClass::PostConditionViolation { invariant_code: 1 },
            FailureClass::BundleNotLanded { bundle_id: [0u8; 32] },
            FailureClass::AltMissingAccount { pubkey: [0u8; 32] },
            FailureClass::ArchivalWriteFailed,
            FailureClass::BubblegumAnchorLag,
            FailureClass::StaleProofReplayDetected,
            FailureClass::ForgedVaultTarget,
            FailureClass::ManipulatedStateRoot,
        ];
        for c in &all {
            let r = remediation_for(c);
            // Every remediation has a non-empty id.
            assert!(!r.id().is_empty(), "empty remediation id for {:?}", c);
        }
    }

    #[test]
    fn pages_oncall_only_for_funds_at_risk_classes() {
        // Spot-check: archival, post-condition, hard quorum disagreement,
        // bubblegum anchor lag — all page.
        for c in [
            FailureClass::ArchivalWriteFailed,
            FailureClass::PostConditionViolation { invariant_code: 1 },
            FailureClass::QuorumDisagreement { hard: true },
            FailureClass::BubblegumAnchorLag,
            FailureClass::PythPullPostFailed,
        ] {
            let r = remediation_for(&c);
            assert!(matches!(
                r,
                Remediation::HaltAndPage(_)
                    | Remediation::AbortAndPage(_)
                    | Remediation::RevertNoRetryPage(_)
            ));
        }
    }

    #[test]
    fn security_classes_emit_security_events() {
        for c in [
            FailureClass::StaleProofReplayDetected,
            FailureClass::ForgedVaultTarget,
            FailureClass::ManipulatedStateRoot,
        ] {
            assert!(matches!(remediation_for(&c), Remediation::RejectAndSecurityEvent(_)));
        }
    }

    #[test]
    fn remediation_ids_are_unique() {
        let all: Vec<FailureClass> = vec![
            FailureClass::QuorumDisagreement { hard: true },
            FailureClass::QuorumDisagreement { hard: false },
            FailureClass::SourceQuarantined { source: SourceId(1) },
            FailureClass::RpcTimeout { source: SourceId(1) },
            FailureClass::StaleAccount { pubkey: [0u8; 32], lag_slots: 100 },
            FailureClass::OracleStale { feed_id: FeedId(1), lag_slots: 30 },
            FailureClass::OracleDeviation { asset: AssetId(1), deviation_bps: 200 },
            FailureClass::PythPullPostFailed,
            FailureClass::AgentTimeout { agent_id: AgentId::TailRisk },
            FailureClass::HardVeto { agent_id: AgentId::TailRisk, reason: RejectionCode::TailRiskBreach },
            FailureClass::DisagreementOverThreshold { score_bps: 4_000 },
            FailureClass::ProofGenTimeout,
            FailureClass::ProofVerifyFailed,
            FailureClass::ProofPublicInputMismatch,
            FailureClass::ComputeExhaustion { predicted_cu: 1_000_000, used_cu: 1_500_000 },
            FailureClass::CpiFailure { protocol: ProtocolId(1), error_code: 7 },
            FailureClass::SlippageViolation { expected_bps: 50, observed_bps: 250 },
            FailureClass::PostConditionViolation { invariant_code: 1 },
            FailureClass::BundleNotLanded { bundle_id: [0u8; 32] },
            FailureClass::AltMissingAccount { pubkey: [0u8; 32] },
            FailureClass::ArchivalWriteFailed,
            FailureClass::BubblegumAnchorLag,
            FailureClass::StaleProofReplayDetected,
            FailureClass::ForgedVaultTarget,
            FailureClass::ManipulatedStateRoot,
        ];
        let mut ids: Vec<&'static str> = all.iter().map(|c| remediation_for(c).id()).collect();
        ids.sort();
        ids.dedup();
        // The two QuorumDisagreement variants share a remediation taxonomy
        // but use distinct ids — every other class gets its own id too.
        assert_eq!(ids.len(), 25, "all 25 variants must have distinct remediation ids");
    }
}
