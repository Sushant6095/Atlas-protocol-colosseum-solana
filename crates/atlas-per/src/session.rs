//! `ErSession` PDA shape (directive §3.2 + §8.2).
//!
//! One `ErSession` account per active rebalance. The gateway program
//! owns the PDA; the keeper opens it at delegation, the verifier
//! settles it at the end of the rebalance, or — if neither happens
//! within `max_session_slots` — Atlas's own keeper auto-undelegates.
//!
//! `pre_state_commitment` is the Pedersen over the vault state at
//! session open. Recording it lets Atlas reclaim the original state
//! even if the rollup operator vanishes.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionLifecycleStatus {
    /// Vault delegated; rollup is executing.
    Open,
    /// Settlement payload landed; vault un-delegated.
    Settled,
    /// `max_session_slots` exceeded; auto-undelegated by Atlas.
    Expired,
    /// Settlement payload contradicted session state; disputed and
    /// rejected.
    Disputed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErSession {
    pub vault_id: Pubkey,
    pub session_id: [u8; 32],
    pub magicblock_program: Pubkey,
    pub opened_at_slot: u64,
    pub max_session_slots: u64,
    pub pre_state_commitment: [u8; 32],
    pub status: SessionLifecycleStatus,
    /// Set once the session settles. Empty until then.
    pub settled_at_slot: Option<u64>,
    /// Bubblegum receipt id of the SessionOpened receipt (Phase 03).
    /// Provides the audit trail anchor.
    pub opened_receipt_id: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SessionOpenError {
    #[error("magicblock_program is the zero pubkey")]
    NullProgram,
    #[error("max_session_slots is zero — sessions would always be expired")]
    ZeroSessionSlots,
    #[error("max_session_slots ({0}) exceeds the gateway cap ({1})")]
    SessionSlotsAboveCap(u64, u64),
}

impl ErSession {
    pub fn open(
        vault_id: Pubkey,
        session_id: [u8; 32],
        magicblock_program: Pubkey,
        opened_at_slot: u64,
        max_session_slots: u64,
        max_session_slots_cap: u64,
        pre_state_commitment: [u8; 32],
        opened_receipt_id: [u8; 32],
    ) -> Result<Self, SessionOpenError> {
        if magicblock_program == [0u8; 32] {
            return Err(SessionOpenError::NullProgram);
        }
        if max_session_slots == 0 {
            return Err(SessionOpenError::ZeroSessionSlots);
        }
        if max_session_slots > max_session_slots_cap {
            return Err(SessionOpenError::SessionSlotsAboveCap(
                max_session_slots,
                max_session_slots_cap,
            ));
        }
        Ok(Self {
            vault_id,
            session_id,
            magicblock_program,
            opened_at_slot,
            max_session_slots,
            pre_state_commitment,
            status: SessionLifecycleStatus::Open,
            settled_at_slot: None,
            opened_receipt_id,
        })
    }

    pub fn deadline_slot(&self) -> u64 {
        self.opened_at_slot.saturating_add(self.max_session_slots)
    }

    pub fn is_expired_at(&self, now_slot: u64) -> bool {
        self.status == SessionLifecycleStatus::Open && now_slot >= self.deadline_slot()
    }

    pub fn is_open(&self) -> bool {
        self.status == SessionLifecycleStatus::Open
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::execution_privacy::MAX_PER_SESSION_SLOTS;

    fn ok() -> ErSession {
        ErSession::open(
            [1u8; 32],
            [9u8; 32],
            [3u8; 32],
            1_000,
            200,
            MAX_PER_SESSION_SLOTS,
            [7u8; 32],
            [0xee; 32],
        )
        .unwrap()
    }

    #[test]
    fn open_session_deadline_correct() {
        let s = ok();
        assert_eq!(s.deadline_slot(), 1_200);
    }

    #[test]
    fn open_session_starts_open() {
        assert!(ok().is_open());
    }

    #[test]
    fn null_program_rejected() {
        let r = ErSession::open(
            [1u8; 32],
            [9u8; 32],
            [0u8; 32],
            1_000,
            200,
            MAX_PER_SESSION_SLOTS,
            [7u8; 32],
            [0xee; 32],
        );
        assert!(matches!(r, Err(SessionOpenError::NullProgram)));
    }

    #[test]
    fn zero_slots_rejected() {
        let r = ErSession::open(
            [1u8; 32],
            [9u8; 32],
            [3u8; 32],
            1_000,
            0,
            MAX_PER_SESSION_SLOTS,
            [7u8; 32],
            [0xee; 32],
        );
        assert!(matches!(r, Err(SessionOpenError::ZeroSessionSlots)));
    }

    #[test]
    fn slots_above_cap_rejected() {
        let r = ErSession::open(
            [1u8; 32],
            [9u8; 32],
            [3u8; 32],
            1_000,
            300,
            MAX_PER_SESSION_SLOTS,
            [7u8; 32],
            [0xee; 32],
        );
        assert!(matches!(r, Err(SessionOpenError::SessionSlotsAboveCap(_, _))));
    }

    #[test]
    fn expired_after_deadline() {
        let s = ok();
        assert!(!s.is_expired_at(1_100));
        assert!(s.is_expired_at(1_200));
        assert!(s.is_expired_at(2_000));
    }

    #[test]
    fn non_open_status_never_expires() {
        let mut s = ok();
        s.status = SessionLifecycleStatus::Settled;
        assert!(!s.is_expired_at(2_000));
    }
}
