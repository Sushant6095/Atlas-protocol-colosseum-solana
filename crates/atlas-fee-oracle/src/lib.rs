//! atlas-fee-oracle — priority-fee oracle (directive 09 §2.2).
//!
//! Consumes QuickNode's priority-fee API + Solana
//! `getRecentPrioritizationFees`, computes a per-(writable account
//! set) fee distribution, and emits the `micro_lamports_per_cu` value
//! Phase 07 §2.3 expects on every bundle.
//!
//! Falls back to the native quorum across remaining RPCs when
//! QuickNode returns data older than 4 slots. Caps the recommendation
//! at the per-vault `max_priority_fee_lamports_per_cu` from the
//! strategy commitment.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Slot threshold past which QuickNode samples are considered stale.
pub const QUICKNODE_STALE_AFTER_SLOTS: u64 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FeeSource {
    Quicknode,
    NativeQuorum,
    /// Combined output: QuickNode preferred, native used to fill gaps.
    Combined,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeRecommendation {
    /// Hash of the sorted writable-account set the recommendation applies to.
    pub account_set_hash: [u8; 32],
    /// Distribution percentiles in micro-lamports per CU.
    pub p50: u64,
    pub p75: u64,
    pub p99: u64,
    /// What the keeper should actually use (default: p75 capped).
    pub recommended: u64,
    pub slot: u64,
    pub source: FeeSource,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FeeOracleError {
    #[error("no fee samples in input window")]
    EmptyDistribution,
    #[error("recommendation drift {drift_bps} bps exceeds tolerance {tolerance_bps} bps")]
    DriftAboveTolerance { drift_bps: u32, tolerance_bps: u32 },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeSample {
    pub micro_lamports_per_cu: u64,
    pub observed_at_slot: u64,
}

/// `account_set_hash = blake3("atlas.fee.account_set.v1" ||
///   sorted_writable_pubkeys)`. Ensures recommendations for the same
///   write set across vaults dedupe cleanly in caches.
pub fn account_set_hash(writable: &BTreeSet<Pubkey>) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.fee.account_set.v1");
    for k in writable {
        h.update(k);
    }
    *h.finalize().as_bytes()
}

/// Compute a recommendation from a sample window. `p75` is the
/// recommended quantile by default; the cap clamps the final value.
pub fn recommend(
    account_set_hash: [u8; 32],
    samples: &[FeeSample],
    current_slot: u64,
    cap_per_cu: u64,
    source: FeeSource,
) -> Result<FeeRecommendation, FeeOracleError> {
    if samples.is_empty() {
        return Err(FeeOracleError::EmptyDistribution);
    }
    let p50 = quantile(samples, 5_000);
    let p75 = quantile(samples, 7_500);
    let p99 = quantile(samples, 9_900);
    let recommended = p75.min(cap_per_cu);
    Ok(FeeRecommendation {
        account_set_hash,
        p50,
        p75,
        p99,
        recommended,
        slot: current_slot,
        source,
    })
}

/// Decide which source to trust given how recent QuickNode's freshest
/// sample is. Returns the source the caller should use.
pub fn pick_source(quicknode_latest_slot: Option<u64>, current_slot: u64) -> FeeSource {
    match quicknode_latest_slot {
        Some(s) if current_slot.saturating_sub(s) <= QUICKNODE_STALE_AFTER_SLOTS => {
            FeeSource::Quicknode
        }
        _ => FeeSource::NativeQuorum,
    }
}

/// Drift validator (directive §2.5 telemetry SLO). Compares the prior
/// recommendation against what landed and flags drift > tolerance.
pub fn validate_drift(
    recommended: u64,
    actually_landed: u64,
    tolerance_bps: u32,
) -> Result<u32, FeeOracleError> {
    let r = recommended.max(1) as i128;
    let a = actually_landed as i128;
    let drift_bps = ((a - r).abs() * 10_000 / r).min(u32::MAX as i128) as u32;
    if drift_bps > tolerance_bps {
        return Err(FeeOracleError::DriftAboveTolerance {
            drift_bps,
            tolerance_bps,
        });
    }
    Ok(drift_bps)
}

fn quantile(samples: &[FeeSample], quantile_bps: u32) -> u64 {
    let mut v: Vec<u64> = samples.iter().map(|s| s.micro_lamports_per_cu).collect();
    v.sort_unstable();
    let q = (quantile_bps.min(10_000) as usize) * (v.len().saturating_sub(1));
    v[q / 10_000]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: u64, slot: u64) -> FeeSample { FeeSample { micro_lamports_per_cu: v, observed_at_slot: slot } }

    #[test]
    fn account_set_hash_is_order_invariant() {
        let mut a = BTreeSet::new();
        a.extend([[1u8; 32], [2u8; 32], [3u8; 32]]);
        let mut b = BTreeSet::new();
        b.extend([[3u8; 32], [1u8; 32], [2u8; 32]]);
        assert_eq!(account_set_hash(&a), account_set_hash(&b));
    }

    #[test]
    fn recommend_clamps_to_cap() {
        let samples: Vec<_> = (1..=11).map(|i| s(i * 10_000, 100)).collect();
        let r = recommend([0u8; 32], &samples, 100, 50_000, FeeSource::Quicknode).unwrap();
        assert_eq!(r.recommended, 50_000);
    }

    #[test]
    fn empty_input_rejects() {
        assert!(matches!(
            recommend([0u8; 32], &[], 100, 1_000_000, FeeSource::Quicknode),
            Err(FeeOracleError::EmptyDistribution)
        ));
    }

    #[test]
    fn pick_source_falls_back_when_stale() {
        assert_eq!(pick_source(Some(100), 100), FeeSource::Quicknode);
        assert_eq!(pick_source(Some(100), 104), FeeSource::Quicknode);
        assert_eq!(pick_source(Some(100), 105), FeeSource::NativeQuorum);
        assert_eq!(pick_source(None, 100), FeeSource::NativeQuorum);
    }

    #[test]
    fn drift_within_tolerance_passes() {
        let drift = validate_drift(10_000, 10_500, 1_000).unwrap();
        assert_eq!(drift, 500);
    }

    #[test]
    fn drift_exceeding_tolerance_rejects() {
        assert!(matches!(
            validate_drift(10_000, 20_000, 500),
            Err(FeeOracleError::DriftAboveTolerance { .. })
        ));
    }
}
