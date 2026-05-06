//! Lineage validation (directive §2.2).
//!
//! Every model has a `parent_model_id` chain that must form a DAG (no
//! cycles, no missing references, no multi-genesis). Genesis models are
//! the only nodes allowed to have `parent_model_id == None`.

use crate::record::{ModelId, ModelRecord};
use std::collections::{HashMap, HashSet};

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum LineageError {
    #[error("duplicate model id seen: {0:?}")]
    DuplicateId(ModelId),
    #[error("cycle detected involving model id {0:?}")]
    Cycle(ModelId),
    #[error("dangling parent: model {child:?} references missing parent {parent:?}")]
    DanglingParent { child: ModelId, parent: ModelId },
    #[error("expected exactly one genesis model; found {0}")]
    GenesisCount(u32),
}

/// Validate a registry snapshot. Returns `Ok(())` when:
/// * every model id is unique,
/// * exactly one genesis (parent_model_id = None) exists,
/// * every non-genesis parent points to a known model id,
/// * the parent graph contains no cycles.
pub fn validate_lineage(records: &[ModelRecord]) -> Result<(), LineageError> {
    let mut by_id: HashMap<ModelId, &ModelRecord> = HashMap::new();
    let mut genesis_count = 0_u32;
    for r in records {
        if by_id.insert(r.model_id, r).is_some() {
            return Err(LineageError::DuplicateId(r.model_id));
        }
        if r.parent_model_id.is_none() {
            genesis_count += 1;
        }
    }
    if genesis_count != 1 {
        return Err(LineageError::GenesisCount(genesis_count));
    }
    for r in records {
        if let Some(parent) = r.parent_model_id {
            if !by_id.contains_key(&parent) {
                return Err(LineageError::DanglingParent { child: r.model_id, parent });
            }
        }
    }
    // Cycle detection — walk parent chain from each node, bail when we hit
    // ourselves.
    for r in records {
        let mut seen = HashSet::new();
        let mut current = Some(r.model_id);
        while let Some(id) = current {
            if !seen.insert(id) {
                return Err(LineageError::Cycle(id));
            }
            current = by_id.get(&id).and_then(|node| node.parent_model_id);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::record::ModelStatus;

    fn rec(id: u8, parent: Option<u8>) -> ModelRecord {
        ModelRecord {
            model_id: [id; 32],
            ensemble_hash: [0u8; 32],
            created_at_slot: 0,
            trainer_pubkey: [0u8; 32],
            training_dataset_hash: [0u8; 32],
            training_config_hash: [0u8; 32],
            feature_schema_version: 1,
            feature_schema_hash: [0u8; 32],
            parent_model_id: parent.map(|p| [p; 32]),
            performance_summary: None,
            status: ModelStatus::Draft,
            audit_log: vec![],
            on_chain_anchor: None,
        }
    }

    #[test]
    fn linear_chain_validates() {
        let r = vec![rec(1, None), rec(2, Some(1)), rec(3, Some(2))];
        validate_lineage(&r).unwrap();
    }

    #[test]
    fn duplicate_id_rejects() {
        let r = vec![rec(1, None), rec(1, None)];
        assert!(matches!(validate_lineage(&r), Err(LineageError::DuplicateId(_))));
    }

    #[test]
    fn dangling_parent_rejects() {
        let r = vec![rec(1, None), rec(2, Some(99))];
        assert!(matches!(
            validate_lineage(&r),
            Err(LineageError::DanglingParent { .. })
        ));
    }

    #[test]
    fn cycle_rejects() {
        // Manually craft a 2-cycle: 1 → 2 → 1.
        let mut a = rec(1, Some(2));
        let mut b = rec(2, Some(1));
        // Make both non-genesis to avoid the genesis-count check rejecting first.
        a.parent_model_id = Some([2; 32]);
        b.parent_model_id = Some([1; 32]);
        // Add a real genesis so genesis count is 1.
        let g = rec(3, None);
        let r = vec![g, a, b];
        assert!(matches!(validate_lineage(&r), Err(LineageError::Cycle(_))));
    }

    #[test]
    fn zero_genesis_rejects() {
        // Two records, both pointing at non-existent parents → dangling first;
        // make a self-referencing pair so genesis count is 0.
        let r = vec![rec(1, Some(2)), rec(2, Some(1))];
        assert!(matches!(validate_lineage(&r), Err(LineageError::GenesisCount(0))));
    }

    #[test]
    fn multi_genesis_rejects() {
        let r = vec![rec(1, None), rec(2, None)];
        assert!(matches!(validate_lineage(&r), Err(LineageError::GenesisCount(2))));
    }
}
