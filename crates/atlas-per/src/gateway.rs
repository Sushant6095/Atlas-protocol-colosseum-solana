//! `atlas_per_gateway` off-chain mirror (directive §3.2 + §8).
//!
//! Tracks active `ErSession` accounts, settles them via the
//! settlement check, and runs the safety primitive that
//! auto-undelegates stalled sessions. The on-chain Pinocchio program
//! mirrors this state machine; the off-chain gateway is what the
//! keeper, /api/v1/per/* endpoints, and chaos harness exercise.

use crate::execution_privacy::MAX_PER_SESSION_SLOTS;
use crate::session::{ErSession, SessionLifecycleStatus, SessionOpenError};
use crate::settlement::{verify_settlement, SettlementError, SettlementPayload, SettlementVerdict};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Open,
    Settled,
    Expired,
    Disputed,
}

impl From<SessionLifecycleStatus> for SessionStatus {
    fn from(s: SessionLifecycleStatus) -> Self {
        match s {
            SessionLifecycleStatus::Open => SessionStatus::Open,
            SessionLifecycleStatus::Settled => SessionStatus::Settled,
            SessionLifecycleStatus::Expired => SessionStatus::Expired,
            SessionLifecycleStatus::Disputed => SessionStatus::Disputed,
        }
    }
}

/// Public events emitted by the gateway. Bubblegum-anchored per
/// directive §8.2 third bullet.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum GatewayEvent {
    SessionOpened { vault_id: Pubkey, session_id: [u8; 32], opened_at_slot: u64 },
    SessionSettled { vault_id: Pubkey, session_id: [u8; 32], settled_at_slot: u64 },
    SessionExpired { vault_id: Pubkey, session_id: [u8; 32], expired_at_slot: u64 },
    SessionDisputed { vault_id: Pubkey, session_id: [u8; 32] },
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GatewayError {
    #[error("vault {0:?} already has an open session")]
    DuplicateOpenSession(Pubkey),
    #[error("session_id {0:?} not found")]
    UnknownSession([u8; 32]),
    #[error(transparent)]
    SessionOpen(#[from] SessionOpenError),
    #[error(transparent)]
    Settlement(#[from] SettlementError),
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PerGateway {
    /// Active sessions keyed by session_id. Settled / Expired /
    /// Disputed sessions stay here for the audit trail; only one
    /// session per vault may be Open at a time.
    sessions: BTreeMap<[u8; 32], ErSession>,
    events: Vec<GatewayEvent>,
}

impl PerGateway {
    pub fn new() -> Self { Self::default() }

    pub fn open_session(
        &mut self,
        vault_id: Pubkey,
        magicblock_program: Pubkey,
        opened_at_slot: u64,
        max_session_slots: u64,
        pre_state_commitment: [u8; 32],
        nonce: [u8; 32],
    ) -> Result<&ErSession, GatewayError> {
        if self
            .sessions
            .values()
            .any(|s| s.vault_id == vault_id && s.is_open())
        {
            return Err(GatewayError::DuplicateOpenSession(vault_id));
        }
        let session_id = derive_session_id(vault_id, nonce);
        let opened_receipt_id = derive_receipt_id(b"atlas.session_opened.v1", vault_id, session_id);
        let session = ErSession::open(
            vault_id,
            session_id,
            magicblock_program,
            opened_at_slot,
            max_session_slots,
            MAX_PER_SESSION_SLOTS,
            pre_state_commitment,
            opened_receipt_id,
        )?;
        self.sessions.insert(session_id, session);
        self.events.push(GatewayEvent::SessionOpened {
            vault_id,
            session_id,
            opened_at_slot,
        });
        Ok(self.sessions.get(&session_id).expect("just inserted"))
    }

    pub fn settle(
        &mut self,
        payload: &SettlementPayload,
        public_input_post_state: [u8; 32],
    ) -> Result<SettlementVerdict, GatewayError> {
        let session = self
            .sessions
            .get_mut(&payload.session_id)
            .ok_or(GatewayError::UnknownSession(payload.session_id))?;
        let result = verify_settlement(session, payload, public_input_post_state);
        match &result {
            Ok(SettlementVerdict::Settled) => {
                self.events.push(GatewayEvent::SessionSettled {
                    vault_id: payload.vault_id,
                    session_id: payload.session_id,
                    settled_at_slot: payload.submitted_at_slot,
                });
            }
            Err(SettlementError::DeadlinePassed { now, .. }) => {
                self.events.push(GatewayEvent::SessionExpired {
                    vault_id: payload.vault_id,
                    session_id: payload.session_id,
                    expired_at_slot: *now,
                });
            }
            Err(SettlementError::UnauthorisedSubmitter { .. }) => {
                self.events.push(GatewayEvent::SessionDisputed {
                    vault_id: payload.vault_id,
                    session_id: payload.session_id,
                });
            }
            _ => {}
        }
        Ok(result?)
    }

    /// Sweep stalled sessions: any Open session whose deadline has
    /// passed at `now_slot` is auto-undelegated (status flips to
    /// `Expired`). Returns the count flipped. The vault state is
    /// unchanged — the rollup operator's failure to settle does not
    /// move funds.
    pub fn sweep_stalled(&mut self, now_slot: u64) -> Vec<[u8; 32]> {
        let mut flipped = Vec::new();
        for (sid, s) in self.sessions.iter_mut() {
            if s.status == SessionLifecycleStatus::Open && s.is_expired_at(now_slot) {
                s.status = SessionLifecycleStatus::Expired;
                self.events.push(GatewayEvent::SessionExpired {
                    vault_id: s.vault_id,
                    session_id: *sid,
                    expired_at_slot: now_slot,
                });
                flipped.push(*sid);
            }
        }
        flipped
    }

    pub fn get(&self, session_id: &[u8; 32]) -> Option<&ErSession> {
        self.sessions.get(session_id)
    }

    pub fn open_for_vault(&self, vault_id: Pubkey) -> Option<&ErSession> {
        self.sessions
            .values()
            .find(|s| s.vault_id == vault_id && s.is_open())
    }

    pub fn events(&self) -> &[GatewayEvent] { &self.events }

    pub fn session_count(&self) -> usize { self.sessions.len() }

    pub fn iter_sessions(&self) -> impl Iterator<Item = &ErSession> {
        self.sessions.values()
    }
}

/// `session_id = blake3("atlas.per.session.v1" || vault_id || nonce)`.
/// Domain-tagged so a session id from another protocol cannot collide.
pub fn derive_session_id(vault_id: Pubkey, nonce: [u8; 32]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.per.session.v1");
    h.update(&vault_id);
    h.update(&nonce);
    *h.finalize().as_bytes()
}

fn derive_receipt_id(domain: &[u8], vault: Pubkey, session: [u8; 32]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(domain);
    h.update(&vault);
    h.update(&session);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_one(g: &mut PerGateway) -> [u8; 32] {
        g.open_session(
            [1u8; 32],
            [3u8; 32],
            1_000,
            200,
            [7u8; 32],
            [9u8; 32],
        )
        .unwrap()
        .session_id
    }

    #[test]
    fn open_session_emits_event() {
        let mut g = PerGateway::new();
        open_one(&mut g);
        assert!(g.events().iter().any(|e| matches!(e, GatewayEvent::SessionOpened { .. })));
    }

    #[test]
    fn duplicate_open_session_rejected() {
        let mut g = PerGateway::new();
        open_one(&mut g);
        let r = g.open_session(
            [1u8; 32],
            [3u8; 32],
            1_001,
            200,
            [7u8; 32],
            [0xee; 32],
        );
        assert!(matches!(r, Err(GatewayError::DuplicateOpenSession(_))));
    }

    #[test]
    fn second_session_after_settlement_allowed() {
        let mut g = PerGateway::new();
        let sid = open_one(&mut g);
        let payload = SettlementPayload {
            vault_id: [1u8; 32],
            session_id: sid,
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
            submitter_program: [3u8; 32],
            submitted_at_slot: 1_100,
        };
        g.settle(&payload, [0xa3; 32]).unwrap();
        // Now a fresh session for the same vault is fine.
        g.open_session([1u8; 32], [3u8; 32], 1_200, 200, [7u8; 32], [0xab; 32]).unwrap();
    }

    #[test]
    fn unknown_session_settle_rejected() {
        let mut g = PerGateway::new();
        let payload = SettlementPayload {
            vault_id: [1u8; 32],
            session_id: [0xff; 32],
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
            submitter_program: [3u8; 32],
            submitted_at_slot: 1_100,
        };
        let r = g.settle(&payload, [0xa3; 32]);
        assert!(matches!(r, Err(GatewayError::UnknownSession(_))));
    }

    #[test]
    fn settle_emits_settled_event() {
        let mut g = PerGateway::new();
        let sid = open_one(&mut g);
        let p = SettlementPayload {
            vault_id: [1u8; 32],
            session_id: sid,
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
            submitter_program: [3u8; 32],
            submitted_at_slot: 1_100,
        };
        g.settle(&p, [0xa3; 32]).unwrap();
        assert!(g.events().iter().any(|e| matches!(e, GatewayEvent::SessionSettled { .. })));
    }

    #[test]
    fn sweep_flips_stalled_to_expired() {
        let mut g = PerGateway::new();
        let sid = open_one(&mut g);
        let flipped = g.sweep_stalled(1_300);
        assert_eq!(flipped, vec![sid]);
        assert_eq!(g.get(&sid).unwrap().status, SessionLifecycleStatus::Expired);
    }

    #[test]
    fn sweep_does_not_touch_settled_or_already_expired() {
        let mut g = PerGateway::new();
        let sid = open_one(&mut g);
        // Pre-settle.
        let p = SettlementPayload {
            vault_id: [1u8; 32],
            session_id: sid,
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
            submitter_program: [3u8; 32],
            submitted_at_slot: 1_100,
        };
        g.settle(&p, [0xa3; 32]).unwrap();
        let flipped = g.sweep_stalled(2_000);
        assert!(flipped.is_empty());
    }

    #[test]
    fn derive_session_id_is_deterministic() {
        let a = derive_session_id([1u8; 32], [9u8; 32]);
        let b = derive_session_id([1u8; 32], [9u8; 32]);
        assert_eq!(a, b);
        let c = derive_session_id([1u8; 32], [0xee; 32]);
        assert_ne!(a, c);
    }

    #[test]
    fn unauthorised_submitter_emits_disputed_event() {
        let mut g = PerGateway::new();
        let sid = open_one(&mut g);
        let p = SettlementPayload {
            vault_id: [1u8; 32],
            session_id: sid,
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
            submitter_program: [0xff; 32],
            submitted_at_slot: 1_100,
        };
        let _ = g.settle(&p, [0xa3; 32]);
        assert!(g.events().iter().any(|e| matches!(e, GatewayEvent::SessionDisputed { .. })));
    }
}
