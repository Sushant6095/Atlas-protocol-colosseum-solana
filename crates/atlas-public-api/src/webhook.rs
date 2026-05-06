//! Webhooks (directive §7.4).
//!
//! HMAC-signed payloads, Idempotency-Key header, replay endpoint for
//! failed deliveries.

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Replay window: deliveries older than this can't be re-played by an
/// attacker (directive §11 anti-pattern: "Webhooks without HMAC
/// signing or replay protection").
pub const REPLAY_WINDOW_SECONDS: u64 = 600;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEvent {
    VaultRebalanceProposed,
    VaultRebalanceLanded,
    VaultDefensiveModeEntered,
    VaultDefensiveModeExited,
    VaultAlert,
    ForensicSignal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebhookSubscription {
    pub subscription_id: String,
    pub url: String,
    pub events: Vec<WebhookEvent>,
    pub vault_id: Option<[u8; 32]>,
    /// Secret used to derive HMAC. Treat as a high-sensitivity secret.
    pub secret: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub delivery_id: [u8; 32],
    pub idempotency_key: [u8; 32],
    pub event: WebhookEvent,
    pub timestamp_unix: u64,
    pub payload: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum WebhookError {
    #[error("HMAC signing failed")]
    SignError,
    #[error("HMAC verification failed")]
    BadSignature,
    #[error("delivery age {age_seconds} s exceeds replay window {window_seconds} s")]
    ReplayWindowExceeded { age_seconds: u64, window_seconds: u64 },
}

/// HMAC-SHA256 over `timestamp || payload`. SHA-256 HMAC accepts any
/// key length; the only way this errors is OOM, which we surface as
/// `WebhookError::SignError`.
pub fn sign_payload(
    secret: &[u8],
    timestamp_unix: u64,
    payload: &[u8],
) -> Result<Vec<u8>, WebhookError> {
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| WebhookError::SignError)?;
    mac.update(&timestamp_unix.to_be_bytes());
    mac.update(payload);
    Ok(mac.finalize().into_bytes().to_vec())
}

pub fn verify_signature(
    secret: &[u8],
    timestamp_unix: u64,
    payload: &[u8],
    candidate_signature: &[u8],
    now_unix: u64,
) -> Result<(), WebhookError> {
    let age = now_unix.saturating_sub(timestamp_unix);
    if age > REPLAY_WINDOW_SECONDS {
        return Err(WebhookError::ReplayWindowExceeded {
            age_seconds: age,
            window_seconds: REPLAY_WINDOW_SECONDS,
        });
    }
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|_| WebhookError::SignError)?;
    mac.update(&timestamp_unix.to_be_bytes());
    mac.update(payload);
    mac.verify_slice(candidate_signature)
        .map_err(|_| WebhookError::BadSignature)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_signature_verifies() {
        let secret = b"shared-secret-32bytes-long-enough!";
        let payload = br#"{"event":"vault.rebalance.landed"}"#;
        let ts = 1_715_000_000;
        let sig = sign_payload(secret, ts, payload).unwrap();
        verify_signature(secret, ts, payload, &sig, ts + 10).unwrap();
    }

    #[test]
    fn tampered_payload_rejects() {
        let secret = b"shared-secret-32bytes-long-enough!";
        let payload = br#"{"event":"vault.rebalance.landed"}"#;
        let ts = 1_715_000_000;
        let sig = sign_payload(secret, ts, payload).unwrap();
        let bad = br#"{"event":"vault.rebalance.attacked"}"#;
        assert!(matches!(
            verify_signature(secret, ts, bad, &sig, ts + 10),
            Err(WebhookError::BadSignature)
        ));
    }

    #[test]
    fn outside_replay_window_rejects() {
        let secret = b"shared-secret-32bytes-long-enough!";
        let payload = b"{}";
        let ts = 1_000;
        let sig = sign_payload(secret, ts, payload).unwrap();
        let now = ts + REPLAY_WINDOW_SECONDS + 1;
        assert!(matches!(
            verify_signature(secret, ts, payload, &sig, now),
            Err(WebhookError::ReplayWindowExceeded { .. })
        ));
    }

    #[test]
    fn wrong_secret_rejects() {
        let payload = b"{}";
        let ts = 1_715_000_000;
        let sig = sign_payload(b"good-secret", ts, payload).unwrap();
        assert!(matches!(
            verify_signature(b"bad-secret", ts, payload, &sig, ts + 10),
            Err(WebhookError::BadSignature)
        ));
    }
}
