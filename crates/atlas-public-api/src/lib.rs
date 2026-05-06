//! atlas-public-api — public platform surface (directive 09 §7).
//!
//! This crate is the off-chain ground-truth for the public REST + WS
//! + webhook contract. The actual HTTP server (axum) wires routes
//! against these typed shapes; the SDK clients (`@atlas/sdk`,
//! `atlas-rs`) consume the same shapes. Replay parity holds because
//! every response carries `archive_root_slot` + Merkle proof against
//! the on-chain Bubblegum root.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod endpoints;
pub mod sdk;
pub mod webhook;

pub use endpoints::{
    rest_endpoints, websocket_endpoints, EndpointSpec, Method, RestEndpoint, WsEndpoint,
};
pub use sdk::{verify_proof_response, ApiVerifyError, ProofResponse};
pub use webhook::{
    sign_payload, verify_signature, WebhookDelivery, WebhookError, WebhookEvent,
    WebhookSubscription, REPLAY_WINDOW_SECONDS,
};
