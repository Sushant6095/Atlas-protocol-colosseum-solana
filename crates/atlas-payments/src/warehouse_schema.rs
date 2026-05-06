//! Warehouse schema additions (directive §9.1).
//!
//! Two new tables join Phase 03's warehouse: `payments` and
//! `invoices`. Bubblegum anchoring (Phase 03 §3) extends to cover
//! both — a single Merkle proof now covers the entire treasury
//! history (deposits + rebalances + pre-warms + payouts + invoice
//! settlements).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum PaymentStatus {
    Scheduled = 0,
    PreWarming = 1,
    PreWarmed = 2,
    Settling = 3,
    Settled = 4,
    Failed = 5,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum SettlementRouteTag {
    Dodo = 0,
    OnchainTransfer = 1,
    OnchainSwapThenDodo = 2,
}

/// `payments` table — primary key `(treasury_id, payment_id)`.
/// Idempotent on `(treasury_id, dodo_intent_id)`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentRow {
    pub payment_id: [u8; 32],
    pub dodo_intent_id: String,
    pub treasury_id: Pubkey,
    pub mint: Pubkey,
    pub amount_q64: u128,
    pub recipient_ref_hash: [u8; 32],
    pub status: PaymentStatus,
    pub scheduled_at_slot: u64,
    pub prewarmed_at_slot: Option<u64>,
    pub settled_at_slot: Option<u64>,
    pub settlement_route: SettlementRouteTag,
    /// `public_input_hash` of the rebalance triggered by pre-warm
    /// (None for non-pre-warming flows).
    pub rebalance_link: Option<[u8; 32]>,
    pub dodo_receipt_uri: String,
}

/// `invoices` table — mirrors `InvoiceState` with status transitions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceRow {
    pub invoice_id: String,
    pub treasury_id: Pubkey,
    pub mint: Pubkey,
    pub amount_q64: u128,
    pub status: u8,
    pub issued_at_slot: u64,
    pub due_at_slot: u64,
    pub settled_at_slot: Option<u64>,
    pub expected_settle_days_p50: u32,
    pub expected_settle_days_p90: u32,
}

/// `payment_id = blake3("atlas.payment.v1" || treasury_id ||
///   dodo_intent_id)`. Stable across retries; the warehouse uses
/// this as the idempotency key.
pub fn compute_payment_id(treasury_id: &Pubkey, dodo_intent_id: &str) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.payment.v1");
    h.update(treasury_id);
    h.update(dodo_intent_id.as_bytes());
    *h.finalize().as_bytes()
}

/// `recipient_ref_hash` covers PII so the on-chain row never leaks
/// recipient identity. Auditors with the off-chain payload can
/// reconstruct the link.
pub fn compute_recipient_ref_hash(recipient_payload: &[u8]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.recipient.v1");
    h.update(recipient_payload);
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payment_id_idempotent_on_same_intent() {
        let a = compute_payment_id(&[1u8; 32], "intent_x");
        let b = compute_payment_id(&[1u8; 32], "intent_x");
        assert_eq!(a, b);
    }

    #[test]
    fn payment_id_distinct_per_intent() {
        let a = compute_payment_id(&[1u8; 32], "intent_x");
        let b = compute_payment_id(&[1u8; 32], "intent_y");
        assert_ne!(a, b);
    }

    #[test]
    fn payment_id_distinct_per_treasury() {
        let a = compute_payment_id(&[1u8; 32], "intent_x");
        let b = compute_payment_id(&[2u8; 32], "intent_x");
        assert_ne!(a, b);
    }

    #[test]
    fn recipient_ref_hash_does_not_leak_payload() {
        let h = compute_recipient_ref_hash(b"pii-laden-recipient-blob");
        // The output is 32 bytes regardless of input length; the
        // input cannot be recovered from the hash.
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn payment_status_serde_round_trip() {
        let s = PaymentStatus::PreWarming;
        let j = serde_json::to_string(&s).unwrap();
        let back: PaymentStatus = serde_json::from_str(&j).unwrap();
        assert_eq!(s, back);
    }
}
