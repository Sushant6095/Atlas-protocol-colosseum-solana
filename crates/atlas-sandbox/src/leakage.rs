//! Point-in-time leakage probe (directive §1.3 + §4 leakage probe).
//!
//! Two checks:
//!
//! 1. **Hard leakage**: any feature row read with `observed_at_slot >
//!    as_of_slot` is logged as a `LeakageViolation` and the backtest fails.
//! 2. **Random shuffle probe** (directive §4): performance on a model
//!    whose features have been randomly shuffled across the time axis
//!    must collapse to baseline. The probe takes a sequence of
//!    `(predicted, realized)` pairs from a real backtest and from a
//!    shuffled backtest and compares MAE — the shuffled MAE must be
//!    materially worse than the real MAE.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LeakageViolation {
    /// Where the leakage was detected (rebalance index inside the backtest).
    pub rebalance_index: u32,
    /// Slot at which the simulated rebalance was supposed to be evaluated.
    pub as_of_slot: u64,
    /// Slot at which the offending feature was observed.
    pub observed_at_slot: u64,
    pub feed_id: u32,
    pub kind: LeakageKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeakageKind {
    /// Future-dated feature observation reached the model.
    FutureFeature,
    /// Same model output produced from shuffled inputs is too close to
    /// the unshuffled output, indicating it didn't depend on the time
    /// axis at all (or that real time was leaked).
    ShuffleProbeFailed,
}

#[derive(Default)]
pub struct LeakageProbe {
    violations: Vec<LeakageViolation>,
}

impl LeakageProbe {
    pub fn new() -> Self {
        Self::default()
    }

    /// Inspect a single feature row. Returns the violation if leakage is
    /// detected; otherwise records nothing. Hard leakage is collected for
    /// the final report — the caller decides whether to abort early.
    pub fn record_feature(
        &mut self,
        rebalance_index: u32,
        feed_id: u32,
        as_of_slot: u64,
        observed_at_slot: u64,
    ) -> Option<LeakageViolation> {
        if observed_at_slot > as_of_slot {
            let v = LeakageViolation {
                rebalance_index,
                as_of_slot,
                observed_at_slot,
                feed_id,
                kind: LeakageKind::FutureFeature,
            };
            self.violations.push(v.clone());
            Some(v)
        } else {
            None
        }
    }

    /// Random shuffle probe. Returns Some(violation) when the shuffled
    /// outputs are within `tolerance_bps` of the unshuffled outputs,
    /// meaning the model didn't actually use the time axis (or the
    /// shuffle didn't disrupt it — both indicate leakage).
    pub fn record_shuffle_probe(
        &mut self,
        unshuffled_mae_bps: u32,
        shuffled_mae_bps: u32,
        tolerance_bps: u32,
    ) -> Option<LeakageViolation> {
        // Healthy probe: shuffled MAE >> unshuffled MAE. Failure: they're
        // within tolerance.
        let diff = shuffled_mae_bps.abs_diff(unshuffled_mae_bps);
        if diff <= tolerance_bps {
            let v = LeakageViolation {
                rebalance_index: 0,
                as_of_slot: 0,
                observed_at_slot: 0,
                feed_id: 0,
                kind: LeakageKind::ShuffleProbeFailed,
            };
            self.violations.push(v.clone());
            Some(v)
        } else {
            None
        }
    }

    pub fn violations(&self) -> &[LeakageViolation] {
        &self.violations
    }

    pub fn is_clean(&self) -> bool {
        self.violations.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn future_feature_is_violation() {
        let mut p = LeakageProbe::new();
        let v = p.record_feature(0, 1, 100, 101).unwrap();
        assert_eq!(v.kind, LeakageKind::FutureFeature);
        assert!(!p.is_clean());
    }

    #[test]
    fn past_feature_is_clean() {
        let mut p = LeakageProbe::new();
        assert!(p.record_feature(0, 1, 100, 99).is_none());
        assert!(p.is_clean());
    }

    #[test]
    fn shuffle_probe_within_tolerance_is_violation() {
        let mut p = LeakageProbe::new();
        // Shuffled MAE matches unshuffled MAE → model didn't depend on time.
        let v = p.record_shuffle_probe(100, 102, 5).unwrap();
        assert_eq!(v.kind, LeakageKind::ShuffleProbeFailed);
    }

    #[test]
    fn shuffle_probe_disrupted_is_clean() {
        let mut p = LeakageProbe::new();
        // Shuffled MAE is much worse → healthy.
        assert!(p.record_shuffle_probe(100, 5_000, 50).is_none());
        assert!(p.is_clean());
    }
}
