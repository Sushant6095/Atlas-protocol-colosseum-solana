//! atlas-bus — real-time data ingestion fabric.
//!
//! Implements directive 02. Owns Stage 01 (`IngestState`) feed plus the live
//! event bus that drives autonomous monitoring (Phase 05).
//!
//! Frame:
//!   - Atlas does not "fetch state" — it operates on a continuous,
//!     content-addressed, deduplicated stream of events.
//!   - Polling is a fallback, never primary.
//!   - Sub-slot freshness, quorum integrity, replayability, backpressure
//!     awareness — all four properties enforced at the type level where
//!     possible, asserted by tests where not.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod event;
pub mod bus;
pub mod source;
pub mod quorum;
pub mod anomaly;
pub mod webhook;
pub mod replay;
pub mod adapters;

pub use event::{
    canonical_event_bytes, event_id, AtlasEvent, BundleStatus, FeedId, OracleSource, Pubkey,
    Signature, SourceId, TxStatus,
};
pub use bus::{AtlasBus, BusConfig, BusError, BusReceiver};
pub use source::{Health, MarketSource, MarketSourceError};
pub use quorum::{QuorumEngine, QuorumPolicy, QuorumOutcome, ReliabilityScore};
pub use anomaly::{AnomalyEngine, AnomalyTrigger};
pub use webhook::{HeliusWebhookReceiver, WebhookError, WebhookEvent};
pub use replay::{ReplayBus, ReplaySource};
