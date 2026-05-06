//! `FailureClass` enum — directive §2.1.
//!
//! Stable u16 variant tags are part of the on-disk wire format
//! (`failure_classifications.code` in Phase 03 §2.7). Renumbering a variant
//! breaks the warehouse — add new variants only at the end of the list.

use serde::{Deserialize, Serialize};

pub type Pubkey = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ProtocolId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct SourceId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct FeedId(pub u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct AssetId(pub u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum AgentId {
    YieldMax = 0,
    VolSuppress = 1,
    LiquidityStability = 2,
    TailRisk = 3,
    ExecEfficiency = 4,
    ProtocolExposure = 5,
    EmergencySentinel = 6,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(u16)]
pub enum RejectionCode {
    InsufficientLiquidity = 1,
    OracleStale = 2,
    ConcentrationCap = 3,
    UtilizationCap = 4,
    VolatilityRegime = 5,
    TailRiskBreach = 6,
    SlippageExceeded = 7,
    CuBudgetExceeded = 8,
    RegimeCrisis = 9,
    ProtocolBlocklisted = 10,
    Token2022Banned = 11,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum FailureClass {
    // Ingestion (1xxx)
    QuorumDisagreement { hard: bool },
    SourceQuarantined { source: SourceId },
    RpcTimeout { source: SourceId },
    StaleAccount { pubkey: Pubkey, lag_slots: u64 },

    // Oracle (2xxx)
    OracleStale { feed_id: FeedId, lag_slots: u64 },
    OracleDeviation { asset: AssetId, deviation_bps: u32 },
    PythPullPostFailed,

    // Inference / Consensus (3xxx)
    AgentTimeout { agent_id: AgentId },
    HardVeto { agent_id: AgentId, reason: RejectionCode },
    DisagreementOverThreshold { score_bps: u32 },

    // Proof (4xxx)
    ProofGenTimeout,
    ProofVerifyFailed,
    ProofPublicInputMismatch,

    // Execution (5xxx)
    ComputeExhaustion { predicted_cu: u32, used_cu: u32 },
    CpiFailure { protocol: ProtocolId, error_code: u32 },
    SlippageViolation { expected_bps: u32, observed_bps: u32 },
    PostConditionViolation { invariant_code: u32 },
    BundleNotLanded { bundle_id: [u8; 32] },
    AltMissingAccount { pubkey: Pubkey },

    // Archival (6xxx)
    ArchivalWriteFailed,
    BubblegumAnchorLag,

    // Adversarial (7xxx)
    StaleProofReplayDetected,
    ForgedVaultTarget,
    ManipulatedStateRoot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(u16)]
pub enum VariantTag {
    QuorumDisagreement = 1001,
    SourceQuarantined = 1002,
    RpcTimeout = 1003,
    StaleAccount = 1004,

    OracleStale = 2001,
    OracleDeviation = 2002,
    PythPullPostFailed = 2003,

    AgentTimeout = 3001,
    HardVeto = 3002,
    DisagreementOverThreshold = 3003,

    ProofGenTimeout = 4001,
    ProofVerifyFailed = 4002,
    ProofPublicInputMismatch = 4003,

    ComputeExhaustion = 5001,
    CpiFailure = 5002,
    SlippageViolation = 5003,
    PostConditionViolation = 5004,
    BundleNotLanded = 5005,
    AltMissingAccount = 5006,

    ArchivalWriteFailed = 6001,
    BubblegumAnchorLag = 6002,

    StaleProofReplayDetected = 7001,
    ForgedVaultTarget = 7002,
    ManipulatedStateRoot = 7003,
}

impl FailureClass {
    /// Stable u16 wire tag — used as `failure_classifications.code` in Phase 03.
    /// Compile-time exhaustive (no default arm) so new variants force a tag.
    pub const fn variant_tag(&self) -> VariantTag {
        match self {
            FailureClass::QuorumDisagreement { .. } => VariantTag::QuorumDisagreement,
            FailureClass::SourceQuarantined { .. } => VariantTag::SourceQuarantined,
            FailureClass::RpcTimeout { .. } => VariantTag::RpcTimeout,
            FailureClass::StaleAccount { .. } => VariantTag::StaleAccount,
            FailureClass::OracleStale { .. } => VariantTag::OracleStale,
            FailureClass::OracleDeviation { .. } => VariantTag::OracleDeviation,
            FailureClass::PythPullPostFailed => VariantTag::PythPullPostFailed,
            FailureClass::AgentTimeout { .. } => VariantTag::AgentTimeout,
            FailureClass::HardVeto { .. } => VariantTag::HardVeto,
            FailureClass::DisagreementOverThreshold { .. } => VariantTag::DisagreementOverThreshold,
            FailureClass::ProofGenTimeout => VariantTag::ProofGenTimeout,
            FailureClass::ProofVerifyFailed => VariantTag::ProofVerifyFailed,
            FailureClass::ProofPublicInputMismatch => VariantTag::ProofPublicInputMismatch,
            FailureClass::ComputeExhaustion { .. } => VariantTag::ComputeExhaustion,
            FailureClass::CpiFailure { .. } => VariantTag::CpiFailure,
            FailureClass::SlippageViolation { .. } => VariantTag::SlippageViolation,
            FailureClass::PostConditionViolation { .. } => VariantTag::PostConditionViolation,
            FailureClass::BundleNotLanded { .. } => VariantTag::BundleNotLanded,
            FailureClass::AltMissingAccount { .. } => VariantTag::AltMissingAccount,
            FailureClass::ArchivalWriteFailed => VariantTag::ArchivalWriteFailed,
            FailureClass::BubblegumAnchorLag => VariantTag::BubblegumAnchorLag,
            FailureClass::StaleProofReplayDetected => VariantTag::StaleProofReplayDetected,
            FailureClass::ForgedVaultTarget => VariantTag::ForgedVaultTarget,
            FailureClass::ManipulatedStateRoot => VariantTag::ManipulatedStateRoot,
        }
    }

    /// Severity is implied by the prefix:
    /// 1xxx ingestion, 2xxx oracle, 3xxx inference, 4xxx proof, 5xxx execution,
    /// 6xxx archival, 7xxx adversarial.
    pub const fn category_prefix(&self) -> u16 {
        (self.variant_tag() as u16) / 1000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variant_tags_are_unique() {
        let tags = [
            VariantTag::QuorumDisagreement,
            VariantTag::SourceQuarantined,
            VariantTag::RpcTimeout,
            VariantTag::StaleAccount,
            VariantTag::OracleStale,
            VariantTag::OracleDeviation,
            VariantTag::PythPullPostFailed,
            VariantTag::AgentTimeout,
            VariantTag::HardVeto,
            VariantTag::DisagreementOverThreshold,
            VariantTag::ProofGenTimeout,
            VariantTag::ProofVerifyFailed,
            VariantTag::ProofPublicInputMismatch,
            VariantTag::ComputeExhaustion,
            VariantTag::CpiFailure,
            VariantTag::SlippageViolation,
            VariantTag::PostConditionViolation,
            VariantTag::BundleNotLanded,
            VariantTag::AltMissingAccount,
            VariantTag::ArchivalWriteFailed,
            VariantTag::BubblegumAnchorLag,
            VariantTag::StaleProofReplayDetected,
            VariantTag::ForgedVaultTarget,
            VariantTag::ManipulatedStateRoot,
        ];
        let mut codes: Vec<u16> = tags.iter().map(|t| *t as u16).collect();
        codes.sort();
        codes.dedup();
        assert_eq!(codes.len(), tags.len(), "variant tags must be unique");
    }

    #[test]
    fn category_prefix_matches_directive_grouping() {
        assert_eq!(FailureClass::QuorumDisagreement { hard: true }.category_prefix(), 1);
        assert_eq!(FailureClass::OracleStale { feed_id: FeedId(1), lag_slots: 30 }.category_prefix(), 2);
        assert_eq!(FailureClass::AgentTimeout { agent_id: AgentId::TailRisk }.category_prefix(), 3);
        assert_eq!(FailureClass::ProofGenTimeout.category_prefix(), 4);
        assert_eq!(FailureClass::CpiFailure { protocol: ProtocolId(1), error_code: 7 }.category_prefix(), 5);
        assert_eq!(FailureClass::ArchivalWriteFailed.category_prefix(), 6);
        assert_eq!(FailureClass::ManipulatedStateRoot.category_prefix(), 7);
    }
}
