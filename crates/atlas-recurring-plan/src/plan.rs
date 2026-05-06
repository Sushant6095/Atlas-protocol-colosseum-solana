//! `RecurringPlan` schema + proof-gated update flow (directive §4.2 + §4.5).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecurringPlan {
    pub vault_id: Pubkey,
    pub source_mint: Pubkey,
    pub target_mint: Pubkey,
    /// Per-slice notional in vault's accounting unit.
    pub slice_notional_q64: u128,
    /// Slot interval between slices.
    pub interval_slots: u64,
    /// Max slippage bps the keeper accepts on a slice.
    pub slippage_budget_bps: u32,
    /// Pause flag — set true in crisis regimes; resumes only on a new proof.
    pub paused: bool,
    /// Plan version. Each proof-gated update bumps this.
    pub version: u64,
    /// `plan_commitment_hash` of the current parameters.
    pub commitment_hash: [u8; 32],
}

/// Strategy commitment bounds (directive §4.5). The AI cannot
/// produce a plan that violates these. Exceeding them in a proof
/// attempt fails verification.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct StrategyCommitmentBounds {
    pub max_slice_notional_q64: u128,
    pub min_interval_slots: u64,
    pub max_interval_slots: u64,
    pub slippage_budget_cap_bps: u32,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RecurringPlanError {
    #[error("slice notional {got} exceeds bound {cap}")]
    SliceTooLarge { got: u128, cap: u128 },
    #[error("interval {got} slots outside bound [{min}, {max}]")]
    IntervalOutOfBand { got: u64, min: u64, max: u64 },
    #[error("slippage budget {got} bps exceeds cap {cap}")]
    SlippageAboveCap { got: u32, cap: u32 },
    #[error("commitment hash mismatch: claimed={claimed:?}, computed={computed:?}")]
    CommitmentMismatch { claimed: [u8; 32], computed: [u8; 32] },
    #[error("plan version did not advance: prior={prior}, new={new}")]
    NonMonotonicVersion { prior: u64, new: u64 },
}

/// `commitment_hash = blake3("atlas.recurring.v1" || canonical_bytes)`.
pub fn plan_commitment_hash(p: &RecurringPlan) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.recurring.v1");
    h.update(&p.vault_id);
    h.update(&p.source_mint);
    h.update(&p.target_mint);
    h.update(&p.slice_notional_q64.to_le_bytes());
    h.update(&p.interval_slots.to_le_bytes());
    h.update(&p.slippage_budget_bps.to_le_bytes());
    h.update(&[p.paused as u8]);
    h.update(&p.version.to_le_bytes());
    *h.finalize().as_bytes()
}

/// Validate a proposed plan update against the strategy commitment
/// bounds AND the prior plan. The proof-gated update_recurring_plan
/// ix runs this predicate; failure means the proof is rejected.
pub fn validate_plan_update(
    prior: &RecurringPlan,
    proposed: &RecurringPlan,
    bounds: &StrategyCommitmentBounds,
) -> Result<(), RecurringPlanError> {
    if proposed.slice_notional_q64 > bounds.max_slice_notional_q64 {
        return Err(RecurringPlanError::SliceTooLarge {
            got: proposed.slice_notional_q64,
            cap: bounds.max_slice_notional_q64,
        });
    }
    if proposed.interval_slots < bounds.min_interval_slots
        || proposed.interval_slots > bounds.max_interval_slots
    {
        return Err(RecurringPlanError::IntervalOutOfBand {
            got: proposed.interval_slots,
            min: bounds.min_interval_slots,
            max: bounds.max_interval_slots,
        });
    }
    if proposed.slippage_budget_bps > bounds.slippage_budget_cap_bps {
        return Err(RecurringPlanError::SlippageAboveCap {
            got: proposed.slippage_budget_bps,
            cap: bounds.slippage_budget_cap_bps,
        });
    }
    if proposed.version <= prior.version {
        return Err(RecurringPlanError::NonMonotonicVersion {
            prior: prior.version,
            new: proposed.version,
        });
    }
    let computed = plan_commitment_hash(proposed);
    if computed != proposed.commitment_hash {
        return Err(RecurringPlanError::CommitmentMismatch {
            claimed: proposed.commitment_hash,
            computed,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds() -> StrategyCommitmentBounds {
        StrategyCommitmentBounds {
            max_slice_notional_q64: 1_000_000,
            min_interval_slots: 100,
            max_interval_slots: 100_000,
            slippage_budget_cap_bps: 100,
        }
    }

    fn plan(version: u64, slice: u128, interval: u64, slip: u32) -> RecurringPlan {
        let mut p = RecurringPlan {
            vault_id: [1u8; 32],
            source_mint: [2u8; 32],
            target_mint: [3u8; 32],
            slice_notional_q64: slice,
            interval_slots: interval,
            slippage_budget_bps: slip,
            paused: false,
            version,
            commitment_hash: [0u8; 32],
        };
        p.commitment_hash = plan_commitment_hash(&p);
        p
    }

    #[test]
    fn happy_path_validates() {
        let prior = plan(1, 100, 1_000, 50);
        let proposed = plan(2, 200, 500, 80);
        validate_plan_update(&prior, &proposed, &bounds()).unwrap();
    }

    #[test]
    fn slice_above_cap_rejects() {
        let prior = plan(1, 100, 1_000, 50);
        let proposed = plan(2, 2_000_000, 1_000, 50);
        let r = validate_plan_update(&prior, &proposed, &bounds());
        assert!(matches!(r, Err(RecurringPlanError::SliceTooLarge { .. })));
    }

    #[test]
    fn interval_below_min_rejects() {
        let prior = plan(1, 100, 1_000, 50);
        let proposed = plan(2, 100, 50, 50);
        let r = validate_plan_update(&prior, &proposed, &bounds());
        assert!(matches!(r, Err(RecurringPlanError::IntervalOutOfBand { .. })));
    }

    #[test]
    fn slippage_above_cap_rejects() {
        let prior = plan(1, 100, 1_000, 50);
        let proposed = plan(2, 100, 1_000, 200);
        let r = validate_plan_update(&prior, &proposed, &bounds());
        assert!(matches!(r, Err(RecurringPlanError::SlippageAboveCap { .. })));
    }

    #[test]
    fn non_monotonic_version_rejects() {
        let prior = plan(5, 100, 1_000, 50);
        let proposed = plan(5, 200, 500, 80);
        let r = validate_plan_update(&prior, &proposed, &bounds());
        assert!(matches!(r, Err(RecurringPlanError::NonMonotonicVersion { .. })));
    }

    #[test]
    fn commitment_hash_must_match() {
        let prior = plan(1, 100, 1_000, 50);
        let mut proposed = plan(2, 200, 500, 80);
        // Mutate a field after the hash was computed → mismatch.
        proposed.slippage_budget_bps = 90;
        let r = validate_plan_update(&prior, &proposed, &bounds());
        assert!(matches!(r, Err(RecurringPlanError::CommitmentMismatch { .. })));
    }
}
