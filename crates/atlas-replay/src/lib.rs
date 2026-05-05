//! atlas-replay — library surface.
//!
//! Exposes the replay primitives the binary uses, and lets the adversarial
//! test corpus and any future fuzz harness depend on the same scenarios
//! without re-implementing them.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod scenarios;
pub mod replay_run;
pub mod whatif;
