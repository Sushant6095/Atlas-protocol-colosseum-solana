//! atlas-cpi-guard — CPI isolation (directive 07 §4).
//!
//! Two enforced invariants for every CPI the rebalancer issues:
//!
//! 1. **Allowlist.** `program_id` must match a hardcoded list (Kamino,
//!    Drift, Jupiter, Marginfi, Token, Token-2022, ATA, Compute Budget,
//!    Memo). Off-list ids reject before any state mutation.
//! 2. **Pre/post snapshot diff.** Before every CPI, snapshot the
//!    relevant Atlas accounts. After, diff and assert that **only the
//!    documented fields** changed. Anything else triggers I-10 revert.
//!
//! The crate also houses the owner re-derivation rule: before a CPI,
//! re-derive expected owners for every passed-in token / state account
//! and reject if owner doesn't match expectation.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod allowlist;
pub mod ownership;
pub mod snapshot;

pub use allowlist::{is_allowlisted, AllowlistedProgram, AllowlistedTarget, ALLOWLIST};
pub use ownership::{check_owner, OwnerCheckError};
pub use snapshot::{
    diff_snapshots, snapshot, AllowedField, SnapshotDiffViolation, AccountSnapshot,
};
