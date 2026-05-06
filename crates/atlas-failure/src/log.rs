//! Failure log entry — Phase 03 `failure_classifications` row source.
//!
//! `message_hash = blake3(error.to_string())` (directive §2.3). The raw
//! error string is logged via tracing only; the warehouse keeps only the
//! hash to avoid PII / large blobs in the analytical store.

use crate::class::{FailureClass, Pubkey};
use crate::remediation::{remediation_for, Remediation};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FailureLogEntry {
    pub slot: u64,
    pub vault_id: Pubkey,
    pub stage: String,
    pub class: FailureClass,
    pub variant_tag: u16,
    pub remediation_id: &'static str,
    pub message_hash: [u8; 32],
    pub recovered_at_slot: Option<u64>,
}

impl FailureLogEntry {
    pub fn new(
        slot: u64,
        vault_id: Pubkey,
        stage: impl Into<String>,
        class: FailureClass,
        message: &str,
    ) -> Self {
        let remediation = remediation_for(&class);
        let variant_tag = class.variant_tag() as u16;
        Self {
            slot,
            vault_id,
            stage: stage.into(),
            class,
            variant_tag,
            remediation_id: remediation.id(),
            message_hash: message_hash(message),
            recovered_at_slot: None,
        }
    }

    pub fn mark_recovered(&mut self, slot: u64) {
        self.recovered_at_slot = Some(slot);
    }

    pub fn remediation(&self) -> Remediation {
        remediation_for(&self.class)
    }
}

pub fn message_hash(message: &str) -> [u8; 32] {
    blake3::hash(message.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_hash_deterministic() {
        let a = message_hash("rebalance failed");
        let b = message_hash("rebalance failed");
        assert_eq!(a, b);
    }

    #[test]
    fn message_hash_changes_on_message_diff() {
        assert_ne!(
            message_hash("rebalance failed: kamino"),
            message_hash("rebalance failed: drift")
        );
    }

    #[test]
    fn entry_carries_remediation_id_and_variant_tag() {
        let entry = FailureLogEntry::new(
            100,
            [1u8; 32],
            "stage-15-submit",
            FailureClass::ArchivalWriteFailed,
            "disk full",
        );
        assert_eq!(entry.variant_tag, 6001);
        assert_eq!(entry.remediation_id, "rem.archival.failed.abort");
    }

    #[test]
    fn mark_recovered_sets_slot() {
        let mut entry = FailureLogEntry::new(
            100,
            [1u8; 32],
            "stage-01-ingest-state",
            FailureClass::QuorumDisagreement { hard: false },
            "two providers disagreed",
        );
        assert_eq!(entry.recovered_at_slot, None);
        entry.mark_recovered(105);
        assert_eq!(entry.recovered_at_slot, Some(105));
    }
}
