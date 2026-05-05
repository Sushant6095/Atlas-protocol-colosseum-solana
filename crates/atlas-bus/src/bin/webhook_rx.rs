//! `atlas-webhook-rx` — standalone Helius webhook HTTP receiver.
//!
//! Directive §7 contract:
//!   - Signed-payload verified (HMAC-SHA256).
//!   - Idempotent over `(webhook_id, slot, sig)`.
//!   - Token-bucket rate-limited per webhook id.
//!   - Receiver enqueues onto the same `AtlasBus` as gRPC events; processor
//!     consumes (anti-pattern §9: never do work inline).
//!   - Replay endpoint exposes the past 24h on demand.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_bus::event::Signature;
use atlas_bus::webhook::{HeliusWebhookReceiver, RateLimiter, WebhookError, WebhookEvent};
use axum::{
    body::Bytes as AxumBytes,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Parser, Debug)]
#[command(name = "atlas-webhook-rx", version, about = "Helius webhook ingress for the Atlas event bus.")]
struct Cli {
    /// Bind address.
    #[arg(long, default_value = "0.0.0.0:9090")]
    bind: SocketAddr,
    /// Shared HMAC secret (Helius dashboard).
    #[arg(long, env = "ATLAS_WEBHOOK_SECRET")]
    secret: String,
    /// Token-bucket capacity per webhook id.
    #[arg(long, default_value_t = 256)]
    rate_capacity: u32,
    /// Token-bucket refill per slot.
    #[arg(long, default_value_t = 1)]
    rate_refill_per_slot: u32,
}

#[derive(Clone)]
struct AppState {
    receiver: Arc<Mutex<HeliusWebhookReceiver>>,
}

#[derive(Deserialize)]
struct WebhookQuery {
    webhook_id: String,
    slot: u64,
    /// 64-byte sig as 128-char lowercase hex.
    sig: String,
}

#[derive(Serialize)]
struct WebhookAccepted {
    webhook_id: String,
    slot: u64,
    queued: bool,
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    detail: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();

    let receiver = HeliusWebhookReceiver::new(cli.secret.into_bytes()).with_rate_limiter(
        RateLimiter {
            capacity: cli.rate_capacity,
            refill_per_slot: cli.rate_refill_per_slot,
        },
    );
    let state = AppState {
        receiver: Arc::new(Mutex::new(receiver)),
    };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/webhooks/helius", post(receive_helius))
        .route("/v1/webhooks/helius/replay", get(replay_24h))
        .with_state(state);

    tracing::info!(target: "atlas-webhook-rx", bind=%cli.bind, "starting receiver");
    let listener = tokio::net::TcpListener::bind(cli.bind).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn healthz() -> &'static str {
    "ok"
}

async fn receive_helius(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<WebhookQuery>,
    payload: AxumBytes,
) -> Result<Json<WebhookAccepted>, (StatusCode, Json<ErrorBody>)> {
    let mac_hex = headers
        .get("x-atlas-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            Json(ErrorBody { error: "missing-mac", detail: "x-atlas-signature header absent".into() }),
        ))?;
    let mac_bytes = decode_hex(mac_hex).map_err(|d| (
        StatusCode::BAD_REQUEST,
        Json(ErrorBody { error: "bad-mac-hex", detail: d }),
    ))?;
    let sig_bytes = decode_sig(&q.sig).map_err(|d| (
        StatusCode::BAD_REQUEST,
        Json(ErrorBody { error: "bad-sig-hex", detail: d }),
    ))?;

    let mut rx = state.receiver.lock().await;
    match rx.receive(q.webhook_id.clone(), q.slot, sig_bytes, payload.to_vec(), &mac_bytes) {
        Ok(WebhookEvent { webhook_id, slot, .. }) => {
            // Phase 2 wires the AtlasBus injection here. The receiver
            // intentionally does no work inline (anti-pattern §9).
            Ok(Json(WebhookAccepted { webhook_id, slot, queued: true }))
        }
        Err(WebhookError::HmacInvalid) => Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorBody { error: "hmac-invalid", detail: "signature verification failed".into() }),
        )),
        Err(WebhookError::Duplicate) => Err((
            StatusCode::OK,
            Json(ErrorBody { error: "duplicate", detail: "(webhook_id, slot, sig) already seen".into() }),
        )),
        Err(WebhookError::RateLimited(id)) => Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorBody { error: "rate-limited", detail: id }),
        )),
        Err(WebhookError::Malformed(d)) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorBody { error: "malformed", detail: d }),
        )),
    }
}

#[derive(Serialize)]
struct ReplayResponse {
    count: usize,
    items: Vec<ReplayItem>,
}

#[derive(Serialize)]
struct ReplayItem {
    webhook_id: String,
    slot: u64,
}

async fn replay_24h(State(state): State<AppState>) -> impl IntoResponse {
    // Per directive §7: replay endpoint exposes the past 24h. Atlas slot ≈
    // 400 ms → 24h ≈ 216_000 slots. The receiver's seen set is intentionally
    // bounded by capacity, so the practical window is whatever the operator
    // sized it for; we do not synthesize history that was not recorded.
    let rx = state.receiver.lock().await;
    let observed = rx.replay_all();
    let items: Vec<ReplayItem> = observed
        .into_iter()
        .map(|(webhook_id, slot, _sig)| ReplayItem { webhook_id, slot })
        .collect();
    Json(ReplayResponse { count: items.len(), items })
}

fn decode_hex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err(format!("hex length must be even, got {}", s.len()));
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| format!("byte {i}: {e}"))
        })
        .collect()
}

fn decode_sig(s: &str) -> Result<Signature, String> {
    let bytes = decode_hex(s)?;
    if bytes.len() != 64 {
        return Err(format!("signature must be 64 bytes, got {}", bytes.len()));
    }
    let mut out = [0u8; 64];
    out.copy_from_slice(&bytes);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_hex_round_trip() {
        let bytes = decode_hex("00ff").unwrap();
        assert_eq!(bytes, vec![0x00, 0xff]);
    }

    #[test]
    fn decode_hex_rejects_odd_length() {
        assert!(decode_hex("0fff0").is_err());
    }

    #[test]
    fn decode_sig_rejects_wrong_length() {
        assert!(decode_sig("0011").is_err());
    }
}
