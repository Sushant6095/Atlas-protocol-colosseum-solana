//! Registry storage trait + in-memory implementation.
//!
//! Production wires a ClickHouse-backed implementation that persists each
//! status transition as a row keyed by `(model_id, slot)`. The in-memory
//! impl below preserves the same invariants (status transitions only,
//! never mutate an approved record) and is used by the CLI for fixture
//! workflows + by Phase 06 tests.

use crate::anchor::{anchor_leaf, RegistryAnchor};
use crate::record::{ModelId, ModelRecord, ModelStatus};
use std::collections::HashMap;

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    #[error("model {0:?} not found")]
    NotFound(ModelId),
    #[error("model {0:?} already exists")]
    AlreadyExists(ModelId),
    #[error("illegal status transition: {from:?} -> {to:?}")]
    IllegalTransition { from: ModelStatus, to: ModelStatus },
    #[error("approved record is immutable; status transitions only")]
    MutateApproved,
}

pub trait ModelRegistry {
    fn insert(&mut self, record: ModelRecord) -> Result<(), RegistryError>;
    fn get(&self, id: ModelId) -> Option<&ModelRecord>;
    fn transition(
        &mut self,
        id: ModelId,
        new_status: ModelStatus,
        signer_set_root: [u8; 32],
        slot: u64,
    ) -> Result<RegistryAnchor, RegistryError>;
    fn anchors(&self) -> &[RegistryAnchor];
}

#[derive(Default)]
pub struct InMemoryRegistry {
    records: HashMap<ModelId, ModelRecord>,
    anchors: Vec<RegistryAnchor>,
}

impl InMemoryRegistry {
    pub fn new() -> Self { Self::default() }
}

impl ModelRegistry for InMemoryRegistry {
    fn insert(&mut self, record: ModelRecord) -> Result<(), RegistryError> {
        if self.records.contains_key(&record.model_id) {
            return Err(RegistryError::AlreadyExists(record.model_id));
        }
        self.records.insert(record.model_id, record);
        Ok(())
    }

    fn get(&self, id: ModelId) -> Option<&ModelRecord> {
        self.records.get(&id)
    }

    fn transition(
        &mut self,
        id: ModelId,
        new_status: ModelStatus,
        signer_set_root: [u8; 32],
        slot: u64,
    ) -> Result<RegistryAnchor, RegistryError> {
        let r = self.records.get_mut(&id).ok_or(RegistryError::NotFound(id))?;
        if !is_legal_transition(r.status, new_status) {
            return Err(RegistryError::IllegalTransition {
                from: r.status,
                to: new_status,
            });
        }
        let prev = r.status;
        r.status = new_status;
        let anchor = RegistryAnchor {
            model_id: id,
            prev_status: Some(prev),
            new_status,
            signer_set_root,
            slot,
        };
        r.on_chain_anchor = Some(anchor_leaf(&anchor));
        self.anchors.push(anchor);
        Ok(anchor)
    }

    fn anchors(&self) -> &[RegistryAnchor] {
        &self.anchors
    }
}

/// Status transition rules (directive §3.1):
///   Draft → Audited → Approved → (DriftFlagged | Deprecated | Slashed)
///   Audited → Slashed (proven leakage during audit)
///   DriftFlagged → Approved (drift cleared)
///   DriftFlagged → Deprecated
///   DriftFlagged → Slashed
fn is_legal_transition(from: ModelStatus, to: ModelStatus) -> bool {
    use ModelStatus::*;
    match (from, to) {
        (Draft, Audited) => true,
        (Audited, Approved) => true,
        (Audited, Slashed) => true,
        (Approved, DriftFlagged) => true,
        (Approved, Deprecated) => true,
        (Approved, Slashed) => true,
        (DriftFlagged, Approved) => true,
        (DriftFlagged, Deprecated) => true,
        (DriftFlagged, Slashed) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::record::{AuditEntry, AuditVerdict};

    fn rec(id: u8) -> ModelRecord {
        ModelRecord {
            model_id: [id; 32],
            ensemble_hash: [0u8; 32],
            created_at_slot: 0,
            trainer_pubkey: [9u8; 32],
            training_dataset_hash: [0u8; 32],
            training_config_hash: [0u8; 32],
            feature_schema_version: 1,
            feature_schema_hash: [0u8; 32],
            parent_model_id: None,
            performance_summary: None,
            status: ModelStatus::Draft,
            audit_log: vec![],
            on_chain_anchor: None,
        }
    }

    #[test]
    fn happy_path_draft_to_approved() {
        let mut reg = InMemoryRegistry::new();
        let mut r = rec(1);
        r.audit_log.push(AuditEntry {
            auditor_pubkey: [1u8; 32],
            verdict: AuditVerdict::Pass,
            signed_report_hash: [0u8; 32],
            signed_at_slot: 100,
        });
        reg.insert(r).unwrap();
        let a1 = reg.transition([1; 32], ModelStatus::Audited, [0u8; 32], 200).unwrap();
        let a2 = reg.transition([1; 32], ModelStatus::Approved, [0u8; 32], 300).unwrap();
        assert_eq!(reg.get([1; 32]).unwrap().status, ModelStatus::Approved);
        assert_eq!(reg.anchors().len(), 2);
        assert_ne!(anchor_leaf(&a1), anchor_leaf(&a2));
    }

    #[test]
    fn illegal_transition_rejects() {
        let mut reg = InMemoryRegistry::new();
        reg.insert(rec(1)).unwrap();
        // Draft → Approved is illegal (must pass through Audited).
        assert!(matches!(
            reg.transition([1; 32], ModelStatus::Approved, [0u8; 32], 200),
            Err(RegistryError::IllegalTransition { .. })
        ));
    }

    #[test]
    fn duplicate_insert_rejects() {
        let mut reg = InMemoryRegistry::new();
        reg.insert(rec(1)).unwrap();
        assert!(matches!(reg.insert(rec(1)), Err(RegistryError::AlreadyExists(_))));
    }

    #[test]
    fn slashed_is_terminal() {
        let mut reg = InMemoryRegistry::new();
        reg.insert(rec(1)).unwrap();
        reg.transition([1; 32], ModelStatus::Audited, [0u8; 32], 100).unwrap();
        reg.transition([1; 32], ModelStatus::Slashed, [0u8; 32], 200).unwrap();
        assert!(matches!(
            reg.transition([1; 32], ModelStatus::Approved, [0u8; 32], 300),
            Err(RegistryError::IllegalTransition { .. })
        ));
    }

    #[test]
    fn drift_flag_can_recover_or_terminate() {
        let mut reg = InMemoryRegistry::new();
        reg.insert(rec(1)).unwrap();
        reg.transition([1; 32], ModelStatus::Audited, [0u8; 32], 100).unwrap();
        reg.transition([1; 32], ModelStatus::Approved, [0u8; 32], 200).unwrap();
        reg.transition([1; 32], ModelStatus::DriftFlagged, [0u8; 32], 300).unwrap();
        // Recovery path.
        reg.transition([1; 32], ModelStatus::Approved, [0u8; 32], 400).unwrap();
        // Or termination via Deprecated.
        reg.transition([1; 32], ModelStatus::Deprecated, [0u8; 32], 500).unwrap();
    }
}
