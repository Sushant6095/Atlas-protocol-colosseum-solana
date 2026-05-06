//! atlas-execution-routes — multi-route execution registry (directive 09 §4).
//!
//! Directive §4.2: every route implements `ExecutionRoute`. Stage 12
//! emits per-leg routing preferences; stage 13 picks routes from a
//! registry based on observed landed-rate × cost EMA. Routes are
//! interchangeable — no leg is locked to a specific route at design
//! time.
//!
//! Directive §4.3: large reallocations bypass single-bundle execution
//! and run through `TwapScheduler`. Each slice is its own atomic
//! Atlas rebalance with its own proof — proof-per-slice keeps the
//! cryptographic guarantees intact.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod registry;
pub mod route;
pub mod twap;

pub use registry::{RouteRegistry, RouteSelectError};
pub use route::{
    DflowRoute, ExecutionRoute, JitoRoute, PlannedLeg, Quote, RouteId, RouteReceipt, SwqosRoute,
};
pub use twap::{
    twap_threshold_check, TwapAbortReason, TwapPlan, TwapScheduler, TwapSlice, TwapSliceResult,
    TWAP_DEFAULT_HORIZON_SLOTS, TWAP_DEFAULT_SLICES,
};
