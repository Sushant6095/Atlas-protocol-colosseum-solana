//! Helius webhook receiver — signed-payload verified, idempotent over
//! `(webhook_id, slot, sig)`. Receiver enqueues onto the bus; processor
//! consumes. Webhooks never do work inline (anti-pattern §9).

use crate::event::Signature;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::BTreeSet;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebhookEvent {
    pub webhook_id: String,
    pub slot: u64,
    pub sig: Signature,
    pub payload: Vec<u8>,
}

#[derive(Debug, thiserror::Error)]
pub enum WebhookError {
    #[error("hmac verification failed")]
    HmacInvalid,
    #[error("payload duplicated; idempotency key reuse")]
    Duplicate,
    #[error("rate-limited; bucket exhausted for webhook {0}")]
    RateLimited(String),
    #[error("malformed payload: {0}")]
    Malformed(String),
}

#[derive(Clone, Copy, Debug)]
pub struct RateLimiter {
    pub capacity: u32,
    pub refill_per_slot: u32,
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self {
            capacity: 256,
            refill_per_slot: 1,
        }
    }
}

#[derive(Default)]
struct BucketState {
    tokens: u32,
    last_slot: u64,
}

/// Receiver state — owns the dedup set and per-webhook rate buckets.
pub struct HeliusWebhookReceiver {
    secret: Vec<u8>,
    seen: BTreeSet<(String, u64, Signature)>,
    buckets: std::collections::BTreeMap<String, BucketState>,
    rate: RateLimiter,
}

impl HeliusWebhookReceiver {
    pub fn new(secret: impl Into<Vec<u8>>) -> Self {
        Self {
            secret: secret.into(),
            seen: BTreeSet::new(),
            buckets: Default::default(),
            rate: RateLimiter::default(),
        }
    }

    pub fn with_rate_limiter(mut self, rate: RateLimiter) -> Self {
        self.rate = rate;
        self
    }

    /// Verify HMAC-SHA256 of the raw payload against the provided signature.
    /// Helius signs payloads with a shared secret; we compute the same MAC
    /// and compare in constant time.
    pub fn verify_hmac(&self, payload: &[u8], expected_mac: &[u8]) -> Result<(), WebhookError> {
        let mut mac = HmacSha256::new_from_slice(&self.secret).map_err(|_| WebhookError::HmacInvalid)?;
        mac.update(payload);
        mac.verify_slice(expected_mac).map_err(|_| WebhookError::HmacInvalid)
    }

    /// Receive a webhook payload. Performs HMAC check, idempotency dedup,
    /// and rate limiting in that order. On success, returns the typed event
    /// for the bus to ingest.
    pub fn receive(
        &mut self,
        webhook_id: String,
        slot: u64,
        sig: Signature,
        payload: Vec<u8>,
        expected_mac: &[u8],
    ) -> Result<WebhookEvent, WebhookError> {
        self.verify_hmac(&payload, expected_mac)?;

        // Rate-limit by webhook id.
        let bucket = self.buckets.entry(webhook_id.clone()).or_insert(BucketState {
            tokens: self.rate.capacity,
            last_slot: slot,
        });
        let elapsed = slot.saturating_sub(bucket.last_slot);
        let refill = (elapsed as u32).saturating_mul(self.rate.refill_per_slot);
        bucket.tokens = bucket.tokens.saturating_add(refill).min(self.rate.capacity);
        bucket.last_slot = slot;
        if bucket.tokens == 0 {
            return Err(WebhookError::RateLimited(webhook_id));
        }
        bucket.tokens -= 1;

        // Idempotency.
        let key = (webhook_id.clone(), slot, sig);
        if !self.seen.insert(key) {
            return Err(WebhookError::Duplicate);
        }

        Ok(WebhookEvent {
            webhook_id,
            slot,
            sig,
            payload,
        })
    }

    /// Replay support — emits all observed events in `(webhook_id, slot)` order.
    pub fn replay_all(&self) -> Vec<(String, u64, Signature)> {
        self.seen.iter().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mac(secret: &[u8], payload: &[u8]) -> Vec<u8> {
        let mut m = HmacSha256::new_from_slice(secret).unwrap();
        m.update(payload);
        m.finalize().into_bytes().to_vec()
    }

    #[test]
    fn accepts_valid_hmac() {
        let secret = b"super-secret";
        let mut rx = HeliusWebhookReceiver::new(secret.to_vec());
        let payload = b"hello".to_vec();
        let m = mac(secret, &payload);
        let sig = [1u8; 64];
        let ev = rx.receive("hook-1".into(), 100, sig, payload.clone(), &m).unwrap();
        assert_eq!(ev.webhook_id, "hook-1");
        assert_eq!(ev.payload, payload);
    }

    #[test]
    fn rejects_tampered_payload() {
        let secret = b"super-secret";
        let mut rx = HeliusWebhookReceiver::new(secret.to_vec());
        let payload = b"hello".to_vec();
        let m = mac(secret, &payload);
        let r = rx.receive("hook-1".into(), 100, [1u8; 64], b"goodbye".to_vec(), &m);
        assert!(matches!(r, Err(WebhookError::HmacInvalid)));
    }

    #[test]
    fn idempotent_on_duplicate_key() {
        let secret = b"super-secret";
        let mut rx = HeliusWebhookReceiver::new(secret.to_vec());
        let payload = b"hi".to_vec();
        let m = mac(secret, &payload);
        let _ = rx.receive("hook-1".into(), 100, [1u8; 64], payload.clone(), &m).unwrap();
        let r = rx.receive("hook-1".into(), 100, [1u8; 64], payload.clone(), &m);
        assert!(matches!(r, Err(WebhookError::Duplicate)));
    }

    #[test]
    fn rate_limit_engages_when_bucket_empty() {
        let secret = b"super-secret";
        let mut rx = HeliusWebhookReceiver::new(secret.to_vec()).with_rate_limiter(RateLimiter {
            capacity: 1,
            refill_per_slot: 0,
        });
        let payload = b"x".to_vec();
        let m = mac(secret, &payload);
        let _ = rx.receive("hook-1".into(), 100, [1u8; 64], payload.clone(), &m).unwrap();
        let mut sig2 = [1u8; 64];
        sig2[0] = 2;
        let r = rx.receive("hook-1".into(), 100, sig2, payload, &m);
        assert!(matches!(r, Err(WebhookError::RateLimited(_))));
    }

    #[test]
    fn replay_returns_observed_events_in_order() {
        let secret = b"s";
        let mut rx = HeliusWebhookReceiver::new(secret.to_vec());
        let payload = b"p".to_vec();
        let m = mac(secret, &payload);
        let _ = rx.receive("hook-a".into(), 100, [1u8; 64], payload.clone(), &m).unwrap();
        let _ = rx.receive("hook-a".into(), 101, [2u8; 64], payload.clone(), &m).unwrap();
        let replay = rx.replay_all();
        assert_eq!(replay.len(), 2);
        assert!(replay[0].1 < replay[1].1);
    }
}
