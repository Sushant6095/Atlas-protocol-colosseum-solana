//! atlas-blackbox — rebalance forensic recording.
//!
//! Implements directive 05 §3. Every rebalance — accepted, rejected, or
//! aborted — produces a black-box record. The record schema is the
//! audit-trail surface that wins the "show me what happened on March 5 at
//! 14:23 UTC" question.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod record;
pub mod write;

pub use record::{
    BlackBoxRecord, BlackBoxStatus, CpiTraceEntry, PostConditionResult, RecordValidationError,
    Timings, BLACKBOX_SCHEMA,
};
pub use write::{write_record, BlackBoxWriteError};
