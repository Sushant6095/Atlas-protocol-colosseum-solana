//! atlas-chaos — typed failure-injection harness (directive 08).
//!
//! Three deliverables in one crate:
//!
//! 1. `inject` — `ChaosInject` enum covering ingestion, oracle,
//!    liquidity, execution, and adversarial failure modes. Every
//!    injector is parameterised by inputs the production pipeline
//!    actually sees, so chaos perturbs **inputs** to the system, not
//!    its internal state (anti-pattern §7 first bullet).
//! 2. `seed` — deterministic SplitMix64 RNG. Every chaos run picks a
//!    seed; replays are byte-identical (§1.6).
//! 3. `outcome` + `report` — the `ExpectedOutcome` enum every injector
//!    is annotated with, the `ChaosReport` JSON shape (§5), and the
//!    deviation accounting CI uses to fail PRs.
//!
//! Plus the directive's compile-time mainnet guard (§4): the
//! `INTENTIONAL_MAINNET_OVERRIDE_DO_NOT_USE` feature emits a
//! `compile_error!` so the build refuses to proceed.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[cfg(feature = "INTENTIONAL_MAINNET_OVERRIDE_DO_NOT_USE")]
compile_error!(
    "chaos against mainnet is forbidden by directive 08 §4. Targets are `Staging` or `Sandbox` only."
);

pub mod env;
pub mod inject;
pub mod outcome;
pub mod report;
pub mod scenario;
pub mod seed;

pub use env::{ChaosTarget, KillSwitchError};
pub use inject::{ByteMutator, ChaosInject, InjectorCategory};
pub use outcome::{ExpectedOutcome, ObservedOutcome, OutcomeDeviation};
pub use report::{ChaosReport, RunbookHit, RunReportError};
pub use scenario::{
    game_day_scenarios, pr_subset, GameDayScenario, ScenarioCase, MANDATORY_GAME_DAYS,
};
pub use seed::{splitmix64, ChaosRng};
