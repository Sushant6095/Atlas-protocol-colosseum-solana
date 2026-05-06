//! atlas-runtime — Solana runtime constraints (directive 07 §1-§3, §9-§11).
//!
//! This crate is the off-chain ground truth for the directive's runtime
//! invariants:
//!
//! * `locks`          — account write-lock minimization (§1).
//! * `tx_size`        — 1232-byte envelope + ≤5 tx per bundle (§2).
//! * `compute_budget` — `predicted_cu` + `micro_lamports_per_cu` (§2.3 + §10).
//! * `zero_copy`      — fixed-layout invariants for hot-path account types
//!                      (§3.2).
//! * `lints`          — runnable invariants for `readonly-discipline`,
//!                      `no-borsh-on-hot-path`, `disallowed-methods` (§12).
//! * `determinism`    — checks the on-chain verifier program respects §9
//!                      (no `Clock::unix_timestamp` in handlers).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod compute_budget;
pub mod determinism;
pub mod lints;
pub mod locks;
pub mod tx_size;
pub mod zero_copy;

pub use compute_budget::{
    ComputeBudgetIxs, CuPredictionDriftError, CuPredictor, CU_HARD_CAP, CU_SLO_P99,
};
pub use determinism::{DeterminismCheck, DeterminismViolation};
pub use lints::{
    check_readonly_discipline, forbid_third_party_in_commitment, lint_disallowed_methods,
    lint_no_borsh_on_hot_path, DisallowedMethod, ReadonlyDisciplineViolation,
    ThirdPartyCommitmentViolation,
};
pub use locks::{lock_collision_set, AccountLockSet, LockClassification, Pubkey};
pub use tx_size::{BundleSizeError, TX_SIZE_LIMIT};
pub use zero_copy::{assert_pod_layout, hex_round_trip, ZeroCopyLayoutError};
