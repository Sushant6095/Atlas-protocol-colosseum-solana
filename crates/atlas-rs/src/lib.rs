//! atlas-rs — Atlas platform client (directive 09 §7.2).
//!
//! Thin client over `/api/v1/*`. The HTTP transport is injected
//! through the `HttpTransport` trait so this crate doesn't pull
//! `reqwest` (or any specific TLS stack) into the workspace —
//! production callers wire reqwest, wasm-fetch, or any compatible
//! transport at the binary level.
//!
//! Methods (matching `@atlas/sdk`):
//!
//! * `client.get_vault(id)`
//! * `client.list_rebalances(vault_id, from, to)`
//! * `client.get_rebalance(public_input_hash)` — full black-box record.
//! * `client.get_proof(public_input_hash)` — proof bytes + Bubblegum
//!   path for client-side verification.
//! * `client.simulate_deposit(vault_id, amount)` — pre-sign payload.
//! * `client.verify_proof(response)` — sanity-check the proof
//!   response (the actual sp1-solana verify call is a thin wrapper
//!   the orchestrator owns).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod client;
pub mod transport;

pub use client::{AtlasClient, ClientError, RebalanceListing};
pub use transport::{HttpTransport, MockTransport, TransportError};
