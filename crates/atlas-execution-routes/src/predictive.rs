//! Predictive routing extension (directive 12 §7).
//!
//! Stage 12 consults Jupiter's Quote API at three forecasted slots:
//! `now`, `now + slot_lag_estimate`, `now + slot_lag_estimate + 1`.
//! Routes whose quoted impact is monotonically worsening over the
//! horizon are penalized in the route preference EMA.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ForecastQuotes {
    pub impact_now_bps: u32,
    pub impact_lag_bps: u32,
    pub impact_lag_plus_one_bps: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PredictiveRoutingDrift {
    pub forecast_median_impact_bps: u32,
    pub observed_impact_bps: u32,
    pub drift_bps: i32,
}

/// Returns the EMA penalty in bps a monotonically-worsening forecast
/// receives. Strictly worsening (now < lag < lag+1) gets the largest
/// penalty; flat or improving forecasts get zero.
pub fn forecast_penalty_bps(q: &ForecastQuotes) -> u32 {
    if q.impact_now_bps < q.impact_lag_bps && q.impact_lag_bps < q.impact_lag_plus_one_bps {
        // Penalty proportional to the worst-vs-best spread.
        q.impact_lag_plus_one_bps.saturating_sub(q.impact_now_bps)
    } else {
        0
    }
}

/// Compute the predictive-routing drift signal: observed post-trade
/// impact minus the forecast median. Emitted by the simulation gate
/// (Phase 01 §9.4) for telemetry.
pub fn predictive_routing_drift_bps(
    forecast: &ForecastQuotes,
    observed_impact_bps: u32,
) -> PredictiveRoutingDrift {
    let mut sorted = [
        forecast.impact_now_bps,
        forecast.impact_lag_bps,
        forecast.impact_lag_plus_one_bps,
    ];
    sorted.sort();
    let median = sorted[1];
    let drift = (observed_impact_bps as i32) - (median as i32);
    PredictiveRoutingDrift {
        forecast_median_impact_bps: median,
        observed_impact_bps,
        drift_bps: drift,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monotonic_worsening_forecast_penalized() {
        let q = ForecastQuotes {
            impact_now_bps: 10,
            impact_lag_bps: 20,
            impact_lag_plus_one_bps: 30,
        };
        assert_eq!(forecast_penalty_bps(&q), 20);
    }

    #[test]
    fn flat_forecast_no_penalty() {
        let q = ForecastQuotes {
            impact_now_bps: 20,
            impact_lag_bps: 20,
            impact_lag_plus_one_bps: 20,
        };
        assert_eq!(forecast_penalty_bps(&q), 0);
    }

    #[test]
    fn improving_forecast_no_penalty() {
        let q = ForecastQuotes {
            impact_now_bps: 30,
            impact_lag_bps: 20,
            impact_lag_plus_one_bps: 10,
        };
        assert_eq!(forecast_penalty_bps(&q), 0);
    }

    #[test]
    fn drift_returns_observed_minus_median() {
        let q = ForecastQuotes {
            impact_now_bps: 10,
            impact_lag_bps: 20,
            impact_lag_plus_one_bps: 30,
        };
        let d = predictive_routing_drift_bps(&q, 25);
        assert_eq!(d.forecast_median_impact_bps, 20);
        assert_eq!(d.drift_bps, 5);
    }

    #[test]
    fn drift_can_be_negative_when_observed_outperforms() {
        let q = ForecastQuotes {
            impact_now_bps: 30,
            impact_lag_bps: 30,
            impact_lag_plus_one_bps: 30,
        };
        let d = predictive_routing_drift_bps(&q, 10);
        assert_eq!(d.drift_bps, -20);
    }
}
