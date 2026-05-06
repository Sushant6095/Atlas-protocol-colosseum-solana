//! atlas-pyth-post — Pyth pull-oracle posting (directive 07 §8).
//!
//! Three contracts the keeper must respect:
//!
//! 1. The keeper requests a fresh `PriceUpdateV2` from Hermes for each
//!    asset in the rebalance.
//! 2. The price update post is the **first instruction** of the bundle;
//!    the verifier reads the price account in a subsequent ix; the
//!    bundle is atomic so a stale or missing post reverts the whole
//!    bundle.
//! 3. The verifier asserts
//!    `posted_slot >= bundle_target_slot - MAX_LAG_SLOTS` and
//!    `confidence_bps <= MAX_CONF_BPS`.
//!
//! This crate exposes:
//!
//! * `PythPostIx` — the post-update ix descriptor (program id + price
//!   account + posted_slot + confidence_bps).
//! * `enforce_first_ix(bundle)` — refuses to assemble a bundle whose
//!   first instruction is not the Pyth post.
//! * `verify_freshness(posted_slot, bundle_target_slot, conf_bps)` —
//!   the same gate `atlas_ovl::verifier` runs, mirrored here so the
//!   keeper can fail fast before paying gas.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod bundle;
pub mod freshness;
pub mod schedule;

pub use bundle::{enforce_first_ix, BundleIxKind, BundleIxRef, BundleLayoutError};
pub use freshness::{verify_freshness, FreshnessError, MAX_CONF_BPS, MAX_LAG_SLOTS};
pub use schedule::{PostRefreshSchedule, PythPostIx};
