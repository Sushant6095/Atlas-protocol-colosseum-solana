//! Model record schema (directive §2.1).

use serde::{Deserialize, Serialize};

pub type ModelId = [u8; 32];
pub type Pubkey = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelStatus {
    Draft,
    Audited,
    Approved,
    DriftFlagged,
    Deprecated,
    Slashed,
}

impl ModelStatus {
    /// Approved ensembles can be adopted by new vaults. Existing vaults
    /// remain bound to the model committed at creation per Phase 01 I-1.
    pub fn is_terminal(&self) -> bool {
        matches!(self, ModelStatus::Deprecated | ModelStatus::Slashed)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditVerdict {
    Pass,
    Fail,
    NeedsRevision,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEntry {
    pub auditor_pubkey: Pubkey,
    pub verdict: AuditVerdict,
    pub signed_report_hash: [u8; 32],
    pub signed_at_slot: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PerformanceSummary {
    pub backtest_report_uri: String,
    pub sandbox_period_start_slot: u64,
    pub sandbox_period_end_slot: u64,
    /// Bps key metrics — realised APY, MWRR, max drawdown, defensive share.
    pub key_metrics_bps: KeyMetricsBps,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct KeyMetricsBps {
    pub realized_apy: i32,
    pub mwrr: i32,
    pub max_drawdown: u32,
    pub defensive_share: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ModelRecord {
    pub model_id: ModelId,
    pub ensemble_hash: [u8; 32],
    pub created_at_slot: u64,
    pub trainer_pubkey: Pubkey,
    pub training_dataset_hash: [u8; 32],
    pub training_config_hash: [u8; 32],
    pub feature_schema_version: u32,
    pub feature_schema_hash: [u8; 32],
    /// `None` only for genesis models. The lineage validator (`§2.2`)
    /// rejects non-genesis records with `parent_model_id == None`.
    pub parent_model_id: Option<ModelId>,
    pub performance_summary: Option<PerformanceSummary>,
    pub status: ModelStatus,
    pub audit_log: Vec<AuditEntry>,
    pub on_chain_anchor: Option<[u8; 32]>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RecordValidationError {
    #[error("model_id must equal blake3(model_bytes); claimed={claimed:?}, computed={computed:?}")]
    ModelIdMismatch { claimed: ModelId, computed: ModelId },
    #[error("non-genesis record requires parent_model_id")]
    MissingParent,
    #[error("status `{0:?}` requires at least one Pass audit entry")]
    AuditMissing(ModelStatus),
    #[error("status `Approved` requires a performance_summary")]
    ApprovedWithoutSummary,
    #[error("trainer_pubkey == auditor_pubkey is forbidden (anti-pattern §6)")]
    TrainerSelfAudit,
}

impl ModelRecord {
    /// Verify `model_id == blake3(model_bytes)` (directive §2.1).
    pub fn check_content_address(&self, model_bytes: &[u8]) -> Result<(), RecordValidationError> {
        let computed = *blake3::hash(model_bytes).as_bytes();
        if computed != self.model_id {
            return Err(RecordValidationError::ModelIdMismatch {
                claimed: self.model_id,
                computed,
            });
        }
        Ok(())
    }

    /// Validate the record's structural invariants:
    /// * Non-genesis records carry a `parent_model_id`.
    /// * `Audited` / `Approved` need at least one `Pass` audit entry.
    /// * `Approved` carries a `performance_summary`.
    /// * Trainer cannot self-audit (§6 anti-pattern).
    pub fn validate(&self, is_genesis: bool) -> Result<(), RecordValidationError> {
        if !is_genesis && self.parent_model_id.is_none() {
            return Err(RecordValidationError::MissingParent);
        }
        if matches!(self.status, ModelStatus::Audited | ModelStatus::Approved)
            && !self.audit_log.iter().any(|e| e.verdict == AuditVerdict::Pass)
        {
            return Err(RecordValidationError::AuditMissing(self.status));
        }
        if self.status == ModelStatus::Approved && self.performance_summary.is_none() {
            return Err(RecordValidationError::ApprovedWithoutSummary);
        }
        for e in &self.audit_log {
            if e.auditor_pubkey == self.trainer_pubkey {
                return Err(RecordValidationError::TrainerSelfAudit);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(status: ModelStatus, parent: Option<ModelId>) -> ModelRecord {
        let bytes = b"model-bytes";
        let model_id = *blake3::hash(bytes).as_bytes();
        ModelRecord {
            model_id,
            ensemble_hash: [1u8; 32],
            created_at_slot: 100,
            trainer_pubkey: [9u8; 32],
            training_dataset_hash: [2u8; 32],
            training_config_hash: [3u8; 32],
            feature_schema_version: 7,
            feature_schema_hash: [4u8; 32],
            parent_model_id: parent,
            performance_summary: None,
            status,
            audit_log: vec![],
            on_chain_anchor: None,
        }
    }

    #[test]
    fn content_address_matches_bytes() {
        let r = rec(ModelStatus::Draft, None);
        r.check_content_address(b"model-bytes").unwrap();
        assert!(r.check_content_address(b"different").is_err());
    }

    #[test]
    fn non_genesis_requires_parent() {
        let r = rec(ModelStatus::Draft, None);
        assert_eq!(
            r.validate(false),
            Err(RecordValidationError::MissingParent)
        );
        // Genesis is OK.
        r.validate(true).unwrap();
    }

    #[test]
    fn audited_requires_pass_audit() {
        let mut r = rec(ModelStatus::Audited, Some([0u8; 32]));
        assert!(matches!(
            r.validate(false),
            Err(RecordValidationError::AuditMissing(ModelStatus::Audited))
        ));
        r.audit_log.push(AuditEntry {
            auditor_pubkey: [1u8; 32],
            verdict: AuditVerdict::Pass,
            signed_report_hash: [0u8; 32],
            signed_at_slot: 200,
        });
        r.validate(false).unwrap();
    }

    #[test]
    fn approved_without_summary_rejects() {
        let mut r = rec(ModelStatus::Approved, Some([0u8; 32]));
        r.audit_log.push(AuditEntry {
            auditor_pubkey: [1u8; 32],
            verdict: AuditVerdict::Pass,
            signed_report_hash: [0u8; 32],
            signed_at_slot: 200,
        });
        assert_eq!(
            r.validate(false),
            Err(RecordValidationError::ApprovedWithoutSummary)
        );
    }

    #[test]
    fn trainer_self_audit_rejects() {
        let mut r = rec(ModelStatus::Audited, Some([0u8; 32]));
        // Auditor key matches trainer key.
        r.audit_log.push(AuditEntry {
            auditor_pubkey: [9u8; 32],
            verdict: AuditVerdict::Pass,
            signed_report_hash: [0u8; 32],
            signed_at_slot: 200,
        });
        assert_eq!(
            r.validate(false),
            Err(RecordValidationError::TrainerSelfAudit)
        );
    }
}
