//! atlas-assets — PUSD asset registry (directive 10 §1).
//!
//! Pins the PUSD mint, decimals, and Token-2022 extension manifest.
//! Per Phase 01 I-11, Atlas refuses any deposit if the on-chain
//! extension set drifts out of the allowed manifest. CI runs a daily
//! drift check against mainnet via [`extension::check_drift`].

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod extension;
pub mod pusd;
pub mod transfer_fee;

pub use extension::{
    check_drift, ExtensionType, ExtensionDrift, ExtensionDriftKind, ObservedExtension,
};
pub use pusd::{
    pusd_mint_for, PusdNetwork, PUSD_DECIMALS, PUSD_EXTENSIONS_ALLOWED, PUSD_EXTENSIONS_FORBIDDEN,
};
pub use transfer_fee::net_amount_after_fee;
