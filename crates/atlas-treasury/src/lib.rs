//! atlas-treasury — PUSD treasury layer (directive 10).
//!
//! Seven modules:
//!
//! * `policy`        — `TreasuryRiskPolicy` schema (§3.2) + commitment hash.
//! * `entity`        — `TreasuryEntity` (§3.1) wrapping multisig + vaults + policy.
//! * `yield_account` — PUSD Yield Account / "Treasury Checking" (§4)
//!                     with idle-buffer policy and the
//!                     defensive-mode buffer ratchet.
//! * `emergency`     — multisig-queued emergency reserve pull (§7.2).
//! * `stable_swap`   — cross-stable router with peg-deviation guard (§8).
//! * `intel`         — stablecoin intelligence triggers (§6): peg
//!                     deviation, flow spike, depth collapse, issuer
//!                     event.
//! * `defensive`     — stable-vault trigger ladder (§7.1) mapping
//!                     intel signals to `StableDefensiveAction`.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod defensive;
pub mod emergency;
pub mod entity;
pub mod intel;
pub mod policy;
pub mod stable_swap;
pub mod yield_account;

pub use defensive::{evaluate_stable_defensive, StableDefensiveAction};
pub use emergency::{prepare_emergency_pull, EmergencyPullError, EmergencyPullProposal};
pub use entity::{TreasuryEntity, TreasuryEntityError};
pub use intel::{
    IssuerEventKind, PegDeviationTracker, StableFlowDirection, StableFlowSpikeTracker,
    StableIntelSignal, StablePoolDepthCollapseTracker,
};
pub use policy::{policy_commitment_hash, PolicyError, TreasuryRiskPolicy};
pub use stable_swap::{
    route_stable_swap, StableSwapError, StableSwapQuote, StableSwapRequest,
};
pub use yield_account::{
    effective_idle_buffer_bps, withdraw_decision, WithdrawDecision, YieldAccount,
};
