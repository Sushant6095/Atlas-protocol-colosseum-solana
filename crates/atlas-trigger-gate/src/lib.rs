//! atlas-trigger-gate — proof-gated Jupiter trigger orders (directive 12 §3).
//!
//! The flagship Phase 12 construct: **zk-verified contingent
//! execution.** A Jupiter trigger fires only when both the price
//! condition AND Atlas's risk conditions are simultaneously satisfied,
//! with the latter cryptographically attested.
//!
//! Account topology:
//!
//! ```text
//! TriggerOrderV2  (Jupiter program)
//!    ▲ delegated authority
//!    │
//! TriggerGate     (this program) ──── conditions_hash
//!    ▲ CPI on execution
//!    │
//! KeeperRunner    (Jupiter keeper) ──── invokes gate_check before swap
//! ```
//!
//! Five modules:
//!
//! * `conditions`    — `AtlasCondition` enum + canonical layout +
//!                     `conditions_hash`.
//! * `attestation`   — `AtlasConditionAttestation` posted by the
//!                     Atlas keeper; freshness + signer guards.
//! * `gate`          — `gate_check` predicate covering the directive's
//!                     5 adversarial cases (stale, wrong vault, wrong
//!                     conditions, spoofed authority, mutated post-creation).
//! * `pda`           — `TriggerGate` PDA shape with `conditions_hash`
//!                     immutable post-creation.
//! * `order_type`    — Five trigger order types (StopLoss,
//!                     TakeProfit, OcoBracket, RegimeExit,
//!                     LpExitOnDepthCollapse).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod attestation;
pub mod conditions;
pub mod gate;
pub mod order_type;
pub mod pda;

pub use attestation::{
    AtlasConditionAttestation, AttestationError, MAX_ATTESTATION_STALE_SLOTS,
};
pub use conditions::{conditions_hash, AtlasCondition, AtlasConditions, ConditionsError};
pub use gate::{gate_check, GateError, GateOutcome};
pub use order_type::{TriggerOrderType, TRIGGER_ORDER_TYPES};
pub use pda::{TriggerGate, TriggerGateError};
