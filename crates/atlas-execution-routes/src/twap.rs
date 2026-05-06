//! TWAP scheduler — proof-per-slice (directive §4.3).
//!
//! Large reallocations bypass single-bundle execution and run through
//! `TwapScheduler`. K slices over a horizon, each its own atomic
//! Atlas rebalance with its own proof. Between slices the pipeline
//! re-ingests state, re-validates oracles, and may abort the
//! remaining slices on deteriorating conditions.

use atlas_bundle::IdempotencyGuard;
use serde::{Deserialize, Serialize};

pub const TWAP_DEFAULT_SLICES: u8 = 8;
pub const TWAP_DEFAULT_HORIZON_SLOTS: u64 = 9_000; // ≈ 1 hour @ 400 ms

/// Threshold check (directive §4.3 first paragraph).
/// Returns `true` if the reallocation is large enough to need TWAP:
/// either > `tvl_threshold_bps` of TVL or > `pool_depth_threshold_bps`
/// of pool depth at ±1 %.
pub fn twap_threshold_check(
    notional_q64: u128,
    tvl_q64: u128,
    pool_depth_q64: u128,
    tvl_threshold_bps: u32,
    pool_depth_threshold_bps: u32,
) -> bool {
    let tvl_share_bps = if tvl_q64 == 0 {
        0
    } else {
        ((notional_q64.saturating_mul(10_000)) / tvl_q64).min(u128::MAX) as u64
    };
    let depth_share_bps = if pool_depth_q64 == 0 {
        0
    } else {
        ((notional_q64.saturating_mul(10_000)) / pool_depth_q64).min(u128::MAX) as u64
    };
    tvl_share_bps > tvl_threshold_bps as u64 || depth_share_bps > pool_depth_threshold_bps as u64
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TwapPlan {
    pub vault_id: [u8; 32],
    pub start_slot: u64,
    pub max_slices: u8,
    pub max_horizon_slots: u64,
    pub total_notional_q64: u128,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TwapSlice {
    pub slice_index: u8,
    pub scheduled_slot: u64,
    pub slice_notional_q64: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TwapSliceResult {
    Landed { bundle_id: [u8; 32], slot: u64 },
    Aborted { reason: TwapAbortReason },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TwapAbortReason {
    /// Oracle confidence dropped below the strategy commitment band.
    OracleDegraded,
    /// Pool depth fell below the slice's required level.
    DepthCollapse,
    /// Defensive vector engaged for some other reason.
    DefensiveModeEntered,
    /// Idempotency guard rejected the slice — caller must investigate.
    DuplicateBundleId,
}

#[derive(Debug, Default)]
pub struct TwapScheduler {
    pub guard: IdempotencyGuard,
}

impl TwapScheduler {
    pub fn new() -> Self { Self::default() }

    /// Compute the slice schedule for a plan. Returns one slice per
    /// `max_slices`, evenly spaced over `max_horizon_slots`.
    pub fn build_slices(plan: &TwapPlan) -> Vec<TwapSlice> {
        let n = plan.max_slices.max(1);
        let per = plan.total_notional_q64 / n as u128;
        let leftover = plan.total_notional_q64 - per * n as u128;
        let interval = plan.max_horizon_slots / n as u64;
        (0..n)
            .map(|i| {
                let mut amt = per;
                if i + 1 == n {
                    amt = amt.saturating_add(leftover);
                }
                TwapSlice {
                    slice_index: i,
                    scheduled_slot: plan.start_slot + (i as u64) * interval,
                    slice_notional_q64: amt,
                }
            })
            .collect()
    }

    /// Drive each slice through the scheduler, registering its
    /// bundle id with the idempotency guard. The caller supplies a
    /// `step` closure that returns the slice's outcome — typically a
    /// thin wrapper around the Phase 01 pipeline run for the slice.
    pub fn execute<F>(
        &mut self,
        plan: &TwapPlan,
        mut step: F,
    ) -> Vec<TwapSliceResult>
    where
        F: FnMut(&TwapSlice) -> TwapSliceResult,
    {
        let slices = Self::build_slices(plan);
        let mut results = Vec::with_capacity(slices.len());
        for slice in &slices {
            let r = step(slice);
            // Register bundle id (if landed) so a later slice can't
            // re-use it — proof-per-slice means each slice has a
            // distinct id.
            if let TwapSliceResult::Landed { bundle_id, .. } = &r {
                if self.guard.try_register(*bundle_id).is_err() {
                    results.push(TwapSliceResult::Aborted {
                        reason: TwapAbortReason::DuplicateBundleId,
                    });
                    break;
                }
            }
            let aborted = matches!(r, TwapSliceResult::Aborted { .. });
            results.push(r);
            if aborted {
                break;
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan() -> TwapPlan {
        TwapPlan {
            vault_id: [1u8; 32],
            start_slot: 100,
            max_slices: 4,
            max_horizon_slots: 1_000,
            total_notional_q64: 100_000,
        }
    }

    #[test]
    fn twap_threshold_check_uses_either_axis() {
        // notional = 5 % of TVL → triggers tvl axis.
        assert!(twap_threshold_check(500, 10_000, 1_000_000, 200, 8_000));
        // notional 1 % of TVL but 50 % of pool depth → triggers depth axis.
        assert!(twap_threshold_check(500, 100_000, 1_000, 200, 200));
        // both below threshold → no twap.
        assert!(!twap_threshold_check(50, 100_000, 100_000, 200, 200));
    }

    #[test]
    fn build_slices_distributes_evenly() {
        let slices = TwapScheduler::build_slices(&plan());
        assert_eq!(slices.len(), 4);
        let total: u128 = slices.iter().map(|s| s.slice_notional_q64).sum();
        assert_eq!(total, plan().total_notional_q64);
        // Slot spacing is uniform.
        assert_eq!(slices[0].scheduled_slot, 100);
        assert_eq!(slices[1].scheduled_slot, 350);
        assert_eq!(slices[3].scheduled_slot, 850);
    }

    #[test]
    fn execute_aborts_on_first_failure() {
        let mut s = TwapScheduler::new();
        let mut counter = 0;
        let res = s.execute(&plan(), |_slice| {
            counter += 1;
            if counter == 2 {
                TwapSliceResult::Aborted { reason: TwapAbortReason::OracleDegraded }
            } else {
                TwapSliceResult::Landed {
                    bundle_id: [counter as u8; 32],
                    slot: 100,
                }
            }
        });
        // 2 outcomes recorded: 1 landed, 1 aborted; the rest are skipped.
        assert_eq!(res.len(), 2);
        assert!(matches!(res[1], TwapSliceResult::Aborted { .. }));
    }

    #[test]
    fn execute_rejects_duplicate_bundle_ids() {
        let mut s = TwapScheduler::new();
        let res = s.execute(&plan(), |_slice| TwapSliceResult::Landed {
            bundle_id: [7u8; 32],
            slot: 100,
        });
        // First slice lands; second sees duplicate id and aborts.
        assert!(matches!(res[0], TwapSliceResult::Landed { .. }));
        assert!(matches!(
            res[1],
            TwapSliceResult::Aborted { reason: TwapAbortReason::DuplicateBundleId }
        ));
    }
}
