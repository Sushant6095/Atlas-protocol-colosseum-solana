//! atlas-forensic — onchain forensic engine.
//!
//! Implements directive 05 §1. Watches protocol state and counterparty
//! wallets, emits typed `ForensicSignal`s into the bus.
//!
//! Determinism (§1.4): forensic signals influence rebalances only through
//! the risk engine. The detector itself runs deterministically over the
//! warehouse for any commitment-bound use; live-network enrichment
//! (Solscan labels, Birdeye tags) is allowed only for monitoring and
//! dashboards.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod signal;
pub mod heuristics;
pub mod engine;

pub use signal::{
    canonical_signal_bytes, signal_id, ForensicSignal, ProtocolId, Pubkey, SignalKind,
};
pub use heuristics::{
    AbnormalWithdrawalTracker, ForensicConfig, LiquidationCascadeTracker, ProtocolFlowTracker,
    SmartMoneyMigrationTracker, WelfordOnline,
};
pub use engine::{ForensicEngine, ForensicEngineConfig};
