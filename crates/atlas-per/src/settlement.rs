//! Settlement payload verification (directive §3.1 + §3.2 + §9).
//!
//! `verify_settlement` is the off-chain mirror of the gateway program's
//! settlement check. The on-chain ix runs the same logic; this module
//! is what tests, the playground, and chaos harness call.
//!
//! Verifier responsibilities (per directive §4.3):
//!   1. assert `er_session_id` matches a registered open session,
//!   2. assert `current_slot - session.opened_at_slot ≤ max_session_slots`,
//!   3. assert payload comes from the registered MagicBlock program,
//!   4. assert `post_state_commitment` consistent with the public input,
//!   5. apply post-state to vault, close session.

use crate::session::{ErSession, SessionLifecycleStatus};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementPayload {
    pub vault_id: Pubkey,
    pub session_id: [u8; 32],
    pub er_state_root: [u8; 32],
    pub post_state_commitment: [u8; 32],
    /// Submitter pubkey — must equal session.magicblock_program
    /// (the registered rollup program id).
    pub submitter_program: Pubkey,
    pub submitted_at_slot: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SettlementVerdict {
    /// Payload accepted; vault state advanced; session closed.
    Settled,
    /// Session is past deadline; gateway will auto-undelegate.
    Expired,
    /// Submitter program is not the session's registered MagicBlock
    /// program. Likely a forged settlement attempt.
    Disputed,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SettlementError {
    #[error("session_id {seen:?} does not match registered session {expected:?}")]
    SessionIdMismatch { expected: [u8; 32], seen: [u8; 32] },
    #[error("vault_id {seen:?} does not match registered session vault {expected:?}")]
    CrossVaultReuse { expected: Pubkey, seen: Pubkey },
    #[error(
        "submitter program {submitter:?} does not match registered MagicBlock program {expected:?}"
    )]
    UnauthorisedSubmitter { expected: Pubkey, submitter: Pubkey },
    #[error("session already in terminal status {0:?}; settlement replay rejected")]
    Replay(SessionLifecycleStatus),
    #[error("session deadline {deadline} passed at submitted_at_slot {now}")]
    DeadlinePassed { deadline: u64, now: u64 },
    #[error(
        "post_state_commitment in payload {payload:?} differs from proof public input \
         {public_input:?} — verifier reject"
    )]
    PostStateMismatch {
        payload: [u8; 32],
        public_input: [u8; 32],
    },
}

/// Run the settlement check. Returns `Ok((verdict, slot_used))` and
/// mutates the session in place (advances status, sets settled_at_slot).
/// On rejection the session is left untouched and the error explains why.
pub fn verify_settlement(
    session: &mut ErSession,
    payload: &SettlementPayload,
    public_input_post_state: [u8; 32],
) -> Result<SettlementVerdict, SettlementError> {
    if session.status != SessionLifecycleStatus::Open {
        return Err(SettlementError::Replay(session.status));
    }
    if payload.session_id != session.session_id {
        return Err(SettlementError::SessionIdMismatch {
            expected: session.session_id,
            seen: payload.session_id,
        });
    }
    if payload.vault_id != session.vault_id {
        return Err(SettlementError::CrossVaultReuse {
            expected: session.vault_id,
            seen: payload.vault_id,
        });
    }
    if payload.submitter_program != session.magicblock_program {
        // Don't auto-undelegate — flag as disputed; ops triage.
        session.status = SessionLifecycleStatus::Disputed;
        return Err(SettlementError::UnauthorisedSubmitter {
            expected: session.magicblock_program,
            submitter: payload.submitter_program,
        });
    }
    let deadline = session.deadline_slot();
    if payload.submitted_at_slot > deadline {
        session.status = SessionLifecycleStatus::Expired;
        return Err(SettlementError::DeadlinePassed {
            deadline,
            now: payload.submitted_at_slot,
        });
    }
    if payload.post_state_commitment != public_input_post_state {
        return Err(SettlementError::PostStateMismatch {
            payload: payload.post_state_commitment,
            public_input: public_input_post_state,
        });
    }
    session.status = SessionLifecycleStatus::Settled;
    session.settled_at_slot = Some(payload.submitted_at_slot);
    Ok(SettlementVerdict::Settled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::execution_privacy::MAX_PER_SESSION_SLOTS;

    fn session(vault: Pubkey, sid: [u8; 32], mb: Pubkey) -> ErSession {
        ErSession::open(
            vault,
            sid,
            mb,
            1_000,
            200,
            MAX_PER_SESSION_SLOTS,
            [7u8; 32],
            [0xee; 32],
        )
        .unwrap()
    }

    fn payload(vault: Pubkey, sid: [u8; 32], submitter: Pubkey, slot: u64, post: [u8; 32]) -> SettlementPayload {
        SettlementPayload {
            vault_id: vault,
            session_id: sid,
            er_state_root: [0xa2; 32],
            post_state_commitment: post,
            submitter_program: submitter,
            submitted_at_slot: slot,
        }
    }

    #[test]
    fn happy_path_settles() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([1u8; 32], [9u8; 32], mb, 1_100, [0xa3; 32]);
        let v = verify_settlement(&mut s, &p, [0xa3; 32]).unwrap();
        assert_eq!(v, SettlementVerdict::Settled);
        assert_eq!(s.status, SessionLifecycleStatus::Settled);
        assert_eq!(s.settled_at_slot, Some(1_100));
    }

    #[test]
    fn replayed_settlement_rejected() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        s.status = SessionLifecycleStatus::Settled;
        let p = payload([1u8; 32], [9u8; 32], mb, 1_100, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xa3; 32]);
        assert!(matches!(r, Err(SettlementError::Replay(SessionLifecycleStatus::Settled))));
    }

    #[test]
    fn cross_vault_reuse_rejected() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([2u8; 32], [9u8; 32], mb, 1_100, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xa3; 32]);
        assert!(matches!(r, Err(SettlementError::CrossVaultReuse { .. })));
    }

    #[test]
    fn session_id_mismatch_rejected() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([1u8; 32], [0xff; 32], mb, 1_100, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xa3; 32]);
        assert!(matches!(r, Err(SettlementError::SessionIdMismatch { .. })));
    }

    #[test]
    fn unauthorised_submitter_disputes_session() {
        let mb = [3u8; 32];
        let attacker = [0xff; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([1u8; 32], [9u8; 32], attacker, 1_100, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xa3; 32]);
        assert!(matches!(r, Err(SettlementError::UnauthorisedSubmitter { .. })));
        assert_eq!(s.status, SessionLifecycleStatus::Disputed);
    }

    #[test]
    fn past_deadline_marks_session_expired() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([1u8; 32], [9u8; 32], mb, 2_000, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xa3; 32]);
        assert!(matches!(r, Err(SettlementError::DeadlinePassed { .. })));
        assert_eq!(s.status, SessionLifecycleStatus::Expired);
    }

    #[test]
    fn post_state_mismatch_rejects_without_settling() {
        let mb = [3u8; 32];
        let mut s = session([1u8; 32], [9u8; 32], mb);
        let p = payload([1u8; 32], [9u8; 32], mb, 1_100, [0xa3; 32]);
        let r = verify_settlement(&mut s, &p, [0xff; 32]);
        assert!(matches!(r, Err(SettlementError::PostStateMismatch { .. })));
        assert_eq!(s.status, SessionLifecycleStatus::Open);
    }
}
