//! Atlas pipeline framework.
//!
//! Implements the 16-stage rebalance pipeline (see `docs/prompts/01-core-execution-engine.md`).
//! Each stage is a `Stage` impl: a pure function from typed input to typed output, with
//! telemetry isolated to `Stage::record_span`. Stages 01–14 must be deterministic and
//! idempotent; stage 15 (`SubmitBundle`) is the only one with external side effects.
//!
//! Invariants:
//!   - I-6 deterministic ordering — collections that hit Poseidon must use BTreeMap, never HashMap
//!   - I-7 no silent fallbacks — every fallible op returns `Result`; default substitutions are forbidden
//!   - I-12 no unwrap on a path reachable in production — enforced via clippy::disallowed_methods
//!
//! Replay: every Stage exposes `replay(ctx, input)` which disables network I/O and reads
//! from the archival store. Stages 01–14 must produce byte-identical outputs in replay
//! against an archived input.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod ctx;
pub mod stage;
pub mod hashing;
pub mod canonical_json;
pub mod stages;
pub mod prover_network;

pub use ctx::PipelineCtx;
pub use stage::{Stage, StageError};
pub use atlas_public_input::PublicInputV2;
