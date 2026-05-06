//! atlas-recurring-plan — adaptive DCA over Jupiter Recurring
//! (directive 12 §4).
//!
//! Jupiter Recurring lets a user schedule periodic swaps. Atlas
//! wraps it: every parameter change (slice size, interval, slippage
//! budget, target asset, pause flag) is proof-gated. The strategy
//! commitment declares the bounds; the AI cannot exceed them.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod cadence;
pub mod plan;

pub use cadence::{
    cadence_for_regime, AdaptiveCadence, CadenceError, MarketRegime, RegimeBoundConfig,
};
pub use plan::{
    plan_commitment_hash, validate_plan_update, RecurringPlan, RecurringPlanError,
    StrategyCommitmentBounds,
};
