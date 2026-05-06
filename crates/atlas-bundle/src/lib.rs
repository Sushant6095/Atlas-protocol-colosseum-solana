//! atlas-bundle — dual-route bundle keeper (directive 07 §6).
//!
//! Atlas pushes every rebalance through two routes in parallel and
//! takes whichever lands first:
//!
//! * **Route A — Jito Block Engine.** Bundle of (setup, verify, CPIs,
//!   record). Tip funded per fee model with a per-vault cap; tip
//!   amount escalates within the cap.
//! * **Route B — SWQoS validator path.** Stake-weighted RPC
//!   (Triton / Helius). `skipPreflight=true` is allowed only after the
//!   local simulation gate (Phase 01 §9.4) returned green.
//!
//! Idempotency: `bundle_id = blake3(public_input_hash || allocation_root
//! || keeper_nonce)`. The vault `record_rb` ix asserts the bundle id
//! has not been recorded for this vault before; double-submission
//! reverts cheaply.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod idempotency;
pub mod region;
pub mod route;
pub mod tip;

pub use idempotency::{bundle_id, IdempotencyGuard, IdempotencyError};
pub use region::{BlockEngineRegion, RegionEma};
pub use route::{Route, RouteOutcome, RouteRecord};
pub use tip::{tip_from_distribution, TipCap, TipOracle};
