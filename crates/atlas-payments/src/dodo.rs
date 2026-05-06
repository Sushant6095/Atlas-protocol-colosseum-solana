//! Dodo webhook payload + signature verification + replay protection
//! (directive §4.1 + §4.4).

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::BTreeSet;

type HmacSha256 = Hmac<Sha256>;

/// Webhooks older than this drop. Mirrors Phase 09 §7.4.
pub const MAX_WEBHOOK_AGE_SECONDS: u64 = 600;

pub const DODO_SCHEMA_V1: &str = "atlas.dodo.payment_schedule.v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PriorityClass {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DodoIntent {
    pub intent_id: String,
    pub amount_q64: u128,
    pub mint: String,
    pub earliest_at_slot: u64,
    pub latest_at_slot: u64,
    pub priority: PriorityClass,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DodoPaymentSchedule {
    pub schema: String,
    pub treasury_id: [u8; 32],
    pub schedule: Vec<DodoIntent>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DodoWebhookPayload {
    pub schedule: DodoPaymentSchedule,
    /// Wall-clock timestamp Dodo signed the payload.
    pub timestamp_unix: u64,
    /// HMAC-SHA256 of `(timestamp || canonical(schedule))` under the
    /// treasury's registered Dodo key.
    pub signature: Vec<u8>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DodoSignatureError {
    #[error("schema must equal `{expected}` (got `{got}`)")]
    BadSchema { expected: &'static str, got: String },
    #[error("treasury id mismatch: expected {expected:?}, payload {got:?}")]
    TreasuryMismatch {
        expected: [u8; 32],
        got: [u8; 32],
    },
    #[error("payload age {age_seconds}s exceeds max {MAX_WEBHOOK_AGE_SECONDS}s")]
    Stale { age_seconds: u64 },
    #[error("HMAC verification failed")]
    BadSignature,
    #[error("schedule contains no entries")]
    EmptySchedule,
    #[error("intent {intent_id} has earliest_at_slot ≥ latest_at_slot")]
    InvertedWindow { intent_id: String },
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IntentDedupError {
    #[error("intent_id `{0}` already processed; replay rejected")]
    Replay(String),
}

/// Verify the webhook against the registered key + freshness +
/// schema + treasury binding. Returns `Ok(())` only when all checks
/// pass.
pub fn verify_dodo_signature(
    payload: &DodoWebhookPayload,
    expected_treasury: &[u8; 32],
    registered_key: &[u8],
    now_unix: u64,
) -> Result<(), DodoSignatureError> {
    if payload.schedule.schema != DODO_SCHEMA_V1 {
        return Err(DodoSignatureError::BadSchema {
            expected: DODO_SCHEMA_V1,
            got: payload.schedule.schema.clone(),
        });
    }
    if &payload.schedule.treasury_id != expected_treasury {
        return Err(DodoSignatureError::TreasuryMismatch {
            expected: *expected_treasury,
            got: payload.schedule.treasury_id,
        });
    }
    let age = now_unix.saturating_sub(payload.timestamp_unix);
    if age > MAX_WEBHOOK_AGE_SECONDS {
        return Err(DodoSignatureError::Stale { age_seconds: age });
    }
    if payload.schedule.schedule.is_empty() {
        return Err(DodoSignatureError::EmptySchedule);
    }
    for i in &payload.schedule.schedule {
        if i.earliest_at_slot >= i.latest_at_slot {
            return Err(DodoSignatureError::InvertedWindow {
                intent_id: i.intent_id.clone(),
            });
        }
    }
    let body = canonical_bytes(&payload.schedule);
    let mut mac =
        HmacSha256::new_from_slice(registered_key).map_err(|_| DodoSignatureError::BadSignature)?;
    mac.update(&payload.timestamp_unix.to_be_bytes());
    mac.update(&body);
    mac.verify_slice(&payload.signature)
        .map_err(|_| DodoSignatureError::BadSignature)
}

/// Compute the HMAC signature for a payload — used by Dodo on the
/// signing side and by tests.
pub fn sign_dodo_payload(
    schedule: &DodoPaymentSchedule,
    timestamp_unix: u64,
    key: &[u8],
) -> Result<Vec<u8>, DodoSignatureError> {
    let mut mac =
        HmacSha256::new_from_slice(key).map_err(|_| DodoSignatureError::BadSignature)?;
    mac.update(&timestamp_unix.to_be_bytes());
    mac.update(&canonical_bytes(schedule));
    Ok(mac.finalize().into_bytes().to_vec())
}

fn canonical_bytes(s: &DodoPaymentSchedule) -> Vec<u8> {
    // Stable canonical encoding — sort intents by intent_id so
    // payloads compose deterministically.
    let mut sorted = s.schedule.clone();
    sorted.sort_by(|a, b| a.intent_id.cmp(&b.intent_id));
    serde_json::to_vec(&DodoPaymentSchedule {
        schema: s.schema.clone(),
        treasury_id: s.treasury_id,
        schedule: sorted,
    })
    .unwrap_or_default()
}

/// In-memory replay-protection store. Production wires the warehouse
/// for persistence; this struct exposes the contract.
#[derive(Default)]
pub struct IntentDedup {
    seen: BTreeSet<String>,
}

impl IntentDedup {
    pub fn new() -> Self { Self::default() }

    pub fn try_register(&mut self, intent_id: &str) -> Result<(), IntentDedupError> {
        if !self.seen.insert(intent_id.to_string()) {
            return Err(IntentDedupError::Replay(intent_id.to_string()));
        }
        Ok(())
    }

    pub fn contains(&self, intent_id: &str) -> bool {
        self.seen.contains(intent_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn schedule() -> DodoPaymentSchedule {
        DodoPaymentSchedule {
            schema: DODO_SCHEMA_V1.into(),
            treasury_id: [0xab; 32],
            schedule: vec![
                DodoIntent {
                    intent_id: "pay_1".into(),
                    amount_q64: 1_000,
                    mint: "PUSD".into(),
                    earliest_at_slot: 100,
                    latest_at_slot: 200,
                    priority: PriorityClass::High,
                },
                DodoIntent {
                    intent_id: "payroll_1".into(),
                    amount_q64: 5_000,
                    mint: "USDC".into(),
                    earliest_at_slot: 300,
                    latest_at_slot: 400,
                    priority: PriorityClass::Critical,
                },
            ],
        }
    }

    fn signed(s: DodoPaymentSchedule, ts: u64, key: &[u8]) -> DodoWebhookPayload {
        let sig = sign_dodo_payload(&s, ts, key).unwrap();
        DodoWebhookPayload { schedule: s, timestamp_unix: ts, signature: sig }
    }

    #[test]
    fn happy_path_verifies() {
        let key = b"shared-secret";
        let p = signed(schedule(), 1_700_000_000, key);
        verify_dodo_signature(&p, &[0xab; 32], key, 1_700_000_010).unwrap();
    }

    #[test]
    fn wrong_treasury_rejects() {
        let key = b"shared-secret";
        let p = signed(schedule(), 1_700_000_000, key);
        let r = verify_dodo_signature(&p, &[0xff; 32], key, 1_700_000_010);
        assert!(matches!(r, Err(DodoSignatureError::TreasuryMismatch { .. })));
    }

    #[test]
    fn stale_payload_rejects() {
        let key = b"shared-secret";
        let p = signed(schedule(), 0, key);
        let r = verify_dodo_signature(&p, &[0xab; 32], key, 10_000);
        assert!(matches!(r, Err(DodoSignatureError::Stale { .. })));
    }

    #[test]
    fn tampered_payload_rejects() {
        let key = b"shared-secret";
        let mut p = signed(schedule(), 1_700_000_000, key);
        p.schedule.schedule[0].amount_q64 = 999_999_999;
        let r = verify_dodo_signature(&p, &[0xab; 32], key, 1_700_000_010);
        assert!(matches!(r, Err(DodoSignatureError::BadSignature)));
    }

    #[test]
    fn wrong_key_rejects() {
        let p = signed(schedule(), 1_700_000_000, b"good");
        let r = verify_dodo_signature(&p, &[0xab; 32], b"bad", 1_700_000_010);
        assert!(matches!(r, Err(DodoSignatureError::BadSignature)));
    }

    #[test]
    fn empty_schedule_rejects() {
        let mut s = schedule();
        s.schedule.clear();
        let p = signed(s, 1_700_000_000, b"k");
        let r = verify_dodo_signature(&p, &[0xab; 32], b"k", 1_700_000_010);
        assert!(matches!(r, Err(DodoSignatureError::EmptySchedule)));
    }

    #[test]
    fn inverted_window_rejects() {
        let mut s = schedule();
        s.schedule[0].latest_at_slot = s.schedule[0].earliest_at_slot;
        let p = signed(s, 1_700_000_000, b"k");
        let r = verify_dodo_signature(&p, &[0xab; 32], b"k", 1_700_000_010);
        assert!(matches!(r, Err(DodoSignatureError::InvertedWindow { .. })));
    }

    #[test]
    fn intent_dedup_blocks_replay() {
        let mut d = IntentDedup::new();
        d.try_register("pay_1").unwrap();
        let r = d.try_register("pay_1");
        assert!(matches!(r, Err(IntentDedupError::Replay(_))));
    }
}
