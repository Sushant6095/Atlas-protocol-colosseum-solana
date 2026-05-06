//! Disclosure audit log (directive I-17).
//!
//! Any code path that decrypts an encrypted balance or amount inside
//! an Atlas service writes an audit log entry that includes the
//! requesting role and the disclosure-policy clause invoked.
//! Disclosure events themselves anchor to the Bubblegum tree
//! (Phase 03 §3) — tampering would require breaking the on-chain
//! anchor.

use crate::disclosure::{DisclosureRole, DisclosureScope, ViewingKey};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

pub const DISCLOSURE_LOG_DOMAIN: &[u8] = b"atlas.disclosure.event.v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisclosureReason {
    AccountingExport,
    RegulatorRequest,
    RecipientUnblind,
    AuditorVerification,
    InternalReview,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DisclosureEvent {
    pub event_id: [u8; 32],
    pub vault_id: Pubkey,
    pub viewing_key_id: [u8; 32],
    pub role: DisclosureRole,
    pub scope: DisclosureScope,
    pub reason: DisclosureReason,
    pub holder: Pubkey,
    pub at_slot: u64,
    /// Hash of the disclosed payload — auditors with the off-chain
    /// payload can verify the binding to this event.
    pub disclosed_payload_hash: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DisclosureLogError {
    #[error("event_id mismatch: claimed={claimed:?}, computed={computed:?}")]
    EventIdMismatch { claimed: [u8; 32], computed: [u8; 32] },
    #[error("vault id mismatch: viewing key {key:?} != event {event:?}")]
    VaultMismatch { key: Pubkey, event: Pubkey },
}

impl DisclosureEvent {
    pub fn new(
        vault_id: Pubkey,
        key: &ViewingKey,
        reason: DisclosureReason,
        at_slot: u64,
        disclosed_payload_hash: [u8; 32],
    ) -> Result<Self, DisclosureLogError> {
        if key.vault_id != vault_id {
            return Err(DisclosureLogError::VaultMismatch {
                key: key.vault_id,
                event: vault_id,
            });
        }
        let event_id = compute_event_id(
            &vault_id,
            &key.key_id,
            key.role,
            key.scope,
            reason,
            &key.holder,
            at_slot,
            &disclosed_payload_hash,
        );
        Ok(Self {
            event_id,
            vault_id,
            viewing_key_id: key.key_id,
            role: key.role,
            scope: key.scope,
            reason,
            holder: key.holder,
            at_slot,
            disclosed_payload_hash,
        })
    }

    pub fn validate(&self) -> Result<(), DisclosureLogError> {
        let computed = compute_event_id(
            &self.vault_id,
            &self.viewing_key_id,
            self.role,
            self.scope,
            self.reason,
            &self.holder,
            self.at_slot,
            &self.disclosed_payload_hash,
        );
        if computed != self.event_id {
            return Err(DisclosureLogError::EventIdMismatch {
                claimed: self.event_id,
                computed,
            });
        }
        Ok(())
    }
}

#[allow(clippy::too_many_arguments)]
fn compute_event_id(
    vault_id: &Pubkey,
    key_id: &[u8; 32],
    role: DisclosureRole,
    scope: DisclosureScope,
    reason: DisclosureReason,
    holder: &Pubkey,
    at_slot: u64,
    disclosed_payload_hash: &[u8; 32],
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(DISCLOSURE_LOG_DOMAIN);
    h.update(vault_id);
    h.update(key_id);
    h.update(&[role as u8]);
    h.update(&[scope as u8]);
    h.update(&[reason as u8]);
    h.update(holder);
    h.update(&at_slot.to_le_bytes());
    h.update(disclosed_payload_hash);
    *h.finalize().as_bytes()
}

#[derive(Default)]
pub struct DisclosureLog {
    events: Vec<DisclosureEvent>,
}

impl DisclosureLog {
    pub fn new() -> Self { Self::default() }
    pub fn append(&mut self, e: DisclosureEvent) { self.events.push(e); }
    pub fn events(&self) -> &[DisclosureEvent] { &self.events }
    pub fn events_for_holder(&self, holder: &Pubkey) -> Vec<&DisclosureEvent> {
        self.events.iter().filter(|e| &e.holder == holder).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::disclosure::{ViewingKeyKind, ViewingKeyStatus};

    fn key() -> ViewingKey {
        ViewingKey {
            key_id: [7u8; 32],
            vault_id: [1u8; 32],
            holder: [2u8; 32],
            role: DisclosureRole::FinanceAdmin,
            scope: DisclosureScope::Full,
            kind: ViewingKeyKind::ElGamal,
            time_window: None,
            status: ViewingKeyStatus::Active,
            issued_at_slot: 100,
        }
    }

    #[test]
    fn event_id_deterministic_and_validates() {
        let e = DisclosureEvent::new([1u8; 32], &key(), DisclosureReason::AccountingExport, 200, [3u8; 32]).unwrap();
        e.validate().unwrap();
    }

    #[test]
    fn event_id_changes_with_payload() {
        let a = DisclosureEvent::new([1u8; 32], &key(), DisclosureReason::AccountingExport, 200, [3u8; 32]).unwrap();
        let b = DisclosureEvent::new([1u8; 32], &key(), DisclosureReason::AccountingExport, 200, [4u8; 32]).unwrap();
        assert_ne!(a.event_id, b.event_id);
    }

    #[test]
    fn vault_mismatch_rejects() {
        let r = DisclosureEvent::new([0xff; 32], &key(), DisclosureReason::AccountingExport, 200, [3u8; 32]);
        assert!(matches!(r, Err(DisclosureLogError::VaultMismatch { .. })));
    }

    #[test]
    fn tampered_event_id_fails_validation() {
        let mut e = DisclosureEvent::new([1u8; 32], &key(), DisclosureReason::AccountingExport, 200, [3u8; 32]).unwrap();
        e.at_slot = 999;
        let r = e.validate();
        assert!(matches!(r, Err(DisclosureLogError::EventIdMismatch { .. })));
    }

    #[test]
    fn log_filters_by_holder() {
        let mut log = DisclosureLog::new();
        let e1 = DisclosureEvent::new([1u8; 32], &key(), DisclosureReason::AccountingExport, 100, [3u8; 32]).unwrap();
        let mut k2 = key();
        k2.holder = [9u8; 32];
        let e2 = DisclosureEvent::new([1u8; 32], &k2, DisclosureReason::RegulatorRequest, 110, [4u8; 32]).unwrap();
        log.append(e1);
        log.append(e2);
        assert_eq!(log.events_for_holder(&[2u8; 32]).len(), 1);
        assert_eq!(log.events_for_holder(&[9u8; 32]).len(), 1);
    }
}
