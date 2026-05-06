//! Drift monitoring (directive §2.4).
//!
//! Three drift signals:
//! 1. Predicted vs realised APY MAE (rolling 7d, 30d).
//! 2. Defensive-mode trigger frequency vs backtest baseline.
//! 3. Agent-level confidence calibration (Brier score).
//!
//! Each signal has a configurable threshold. When any threshold is exceeded
//! the registry marks the model `DriftFlagged` and the alert engine pages
//! governance.

use serde::{Deserialize, Serialize};

/// Mean Absolute Error over predicted vs realised APY pairs, in bps.
pub fn mae_bps(predicted_bps: &[i32], realised_bps: &[i32]) -> u32 {
    assert_eq!(predicted_bps.len(), realised_bps.len(), "MAE requires paired inputs");
    if predicted_bps.is_empty() {
        return 0;
    }
    let sum: u64 = predicted_bps
        .iter()
        .zip(realised_bps.iter())
        .map(|(p, r)| ((*p as i64) - (*r as i64)).unsigned_abs())
        .sum();
    (sum / predicted_bps.len() as u64) as u32
}

/// Brier score over `(predicted_probability_bps, observed_outcome)` pairs.
/// Outcomes are 0 / 1; predictions are bps in `[0, 10_000]`. Lower is
/// better. Returned in bps² → `bps²` cap at `10_000²`. We rescale to bps
/// for digest readability by taking sqrt and rounding.
pub fn brier_score_bps(predictions_bps: &[u32], outcomes: &[bool]) -> u32 {
    assert_eq!(predictions_bps.len(), outcomes.len(), "Brier requires paired inputs");
    if predictions_bps.is_empty() {
        return 0;
    }
    let sum_sq: u64 = predictions_bps
        .iter()
        .zip(outcomes.iter())
        .map(|(p, o)| {
            let target = if *o { 10_000 } else { 0 };
            let diff = (*p as i64 - target as i64).unsigned_abs();
            diff * diff
        })
        .sum();
    let mean_sq = sum_sq / predictions_bps.len() as u64;
    (mean_sq as f64).sqrt() as u32
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct DefensiveBaseline {
    /// Triggers per 1_000 slots in the original sandbox backtest.
    pub trigger_rate_per_kslot: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct DriftThresholds {
    /// Hard ceiling for `mae_bps_7d`. Default 200 bps.
    pub mae_7d_max_bps: u32,
    /// Hard ceiling for `mae_bps_30d`. Default 150 bps.
    pub mae_30d_max_bps: u32,
    /// Maximum multiplier vs the backtest baseline before drift flags.
    /// Default 3× — defensive triggers in production may be higher than
    /// in backtest, but >3× is anomalous.
    pub defensive_trigger_max_multiplier: f64,
    /// Brier score ceiling. Default 4_000 (i.e. probability error ≥ 0.4 of
    /// outcome) — higher means the model's confidence is uncalibrated.
    pub brier_max_bps: u32,
}

impl Default for DriftThresholds {
    fn default() -> Self {
        Self {
            mae_7d_max_bps: 200,
            mae_30d_max_bps: 150,
            defensive_trigger_max_multiplier: 3.0,
            brier_max_bps: 4_000,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DriftAlert {
    Mae7d,
    Mae30d,
    DefensiveTriggerSpike,
    BrierScoreBlowup,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DriftReport {
    pub mae_7d_bps: u32,
    pub mae_30d_bps: u32,
    pub defensive_trigger_rate_per_kslot: f64,
    pub brier_score_bps: u32,
    pub alerts: Vec<DriftAlert>,
}

pub fn evaluate_drift(
    mae_7d_bps: u32,
    mae_30d_bps: u32,
    defensive_baseline: DefensiveBaseline,
    defensive_observed_per_kslot: f64,
    brier_score_bps: u32,
    th: DriftThresholds,
) -> DriftReport {
    let mut alerts = Vec::new();
    if mae_7d_bps > th.mae_7d_max_bps {
        alerts.push(DriftAlert::Mae7d);
    }
    if mae_30d_bps > th.mae_30d_max_bps {
        alerts.push(DriftAlert::Mae30d);
    }
    if defensive_observed_per_kslot
        > defensive_baseline.trigger_rate_per_kslot * th.defensive_trigger_max_multiplier
    {
        alerts.push(DriftAlert::DefensiveTriggerSpike);
    }
    if brier_score_bps > th.brier_max_bps {
        alerts.push(DriftAlert::BrierScoreBlowup);
    }
    DriftReport {
        mae_7d_bps,
        mae_30d_bps,
        defensive_trigger_rate_per_kslot: defensive_observed_per_kslot,
        brier_score_bps,
        alerts,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mae_perfect_predictor_is_zero() {
        let p = vec![100, 200, 300];
        let r = vec![100, 200, 300];
        assert_eq!(mae_bps(&p, &r), 0);
    }

    #[test]
    fn mae_constant_offset() {
        let p = vec![100, 200, 300];
        let r = vec![150, 250, 350];
        assert_eq!(mae_bps(&p, &r), 50);
    }

    #[test]
    fn brier_perfect_calibration_is_zero() {
        let p = vec![10_000, 0, 10_000];
        let o = vec![true, false, true];
        assert_eq!(brier_score_bps(&p, &o), 0);
    }

    #[test]
    fn brier_worst_calibration_is_max() {
        // Always predicts opposite of outcome → 10_000 bps difference each.
        let p = vec![0, 10_000, 0];
        let o = vec![true, false, true];
        let b = brier_score_bps(&p, &o);
        assert!(b > 9_900, "got {b}");
    }

    #[test]
    fn drift_report_flags_mae_7d_above_threshold() {
        let r = evaluate_drift(
            300,
            100,
            DefensiveBaseline { trigger_rate_per_kslot: 1.0 },
            2.0,
            1_000,
            DriftThresholds::default(),
        );
        assert!(r.alerts.contains(&DriftAlert::Mae7d));
        assert!(!r.alerts.contains(&DriftAlert::Mae30d));
    }

    #[test]
    fn drift_report_flags_defensive_spike() {
        let r = evaluate_drift(
            50,
            50,
            DefensiveBaseline { trigger_rate_per_kslot: 1.0 },
            5.0,
            1_000,
            DriftThresholds::default(),
        );
        assert!(r.alerts.contains(&DriftAlert::DefensiveTriggerSpike));
    }

    #[test]
    fn drift_report_clean_when_within_thresholds() {
        let r = evaluate_drift(
            50,
            50,
            DefensiveBaseline { trigger_rate_per_kslot: 1.0 },
            2.0,
            500,
            DriftThresholds::default(),
        );
        assert!(r.alerts.is_empty());
    }
}
