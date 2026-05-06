//! AI-modulated cadence model (directive §4.3).
//!
//! Slice size is scaled down in high-vol, scaled up in calm. Interval
//! is stretched in panic regimes, compressed when accumulation
//! conditions are detected. Slippage budget is tightened in shallow
//! liquidity. The pause flag fires in crisis.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketRegime {
    Accumulation,
    Calm,
    Neutral,
    HighVol,
    Panic,
    Crisis,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdaptiveCadence {
    pub slice_notional_q64: u128,
    pub interval_slots: u64,
    pub slippage_budget_bps: u32,
    pub paused: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegimeBoundConfig {
    pub baseline_slice_q64: u128,
    pub baseline_interval_slots: u64,
    pub baseline_slippage_bps: u32,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CadenceError {
    #[error("baseline_slice_q64 must be > 0")]
    ZeroBaselineSlice,
    #[error("baseline_interval_slots must be > 0")]
    ZeroBaselineInterval,
}

/// Map a market regime to adaptive cadence parameters within the
/// strategy commitment's bounds. Crisis fires the pause flag; every
/// other regime modulates within the baseline.
pub fn cadence_for_regime(
    regime: MarketRegime,
    cfg: &RegimeBoundConfig,
) -> Result<AdaptiveCadence, CadenceError> {
    if cfg.baseline_slice_q64 == 0 {
        return Err(CadenceError::ZeroBaselineSlice);
    }
    if cfg.baseline_interval_slots == 0 {
        return Err(CadenceError::ZeroBaselineInterval);
    }
    let (slice_mul_bps, interval_mul_bps, slip_mul_bps, paused) = match regime {
        MarketRegime::Accumulation => (15_000, 5_000, 8_000, false),
        MarketRegime::Calm => (12_000, 8_000, 8_000, false),
        MarketRegime::Neutral => (10_000, 10_000, 10_000, false),
        MarketRegime::HighVol => (5_000, 15_000, 12_000, false),
        MarketRegime::Panic => (2_500, 25_000, 6_000, false),
        MarketRegime::Crisis => (0, 0, 0, true),
    };
    Ok(AdaptiveCadence {
        slice_notional_q64: cfg.baseline_slice_q64.saturating_mul(slice_mul_bps as u128) / 10_000,
        interval_slots: cfg
            .baseline_interval_slots
            .saturating_mul(interval_mul_bps)
            / 10_000,
        slippage_budget_bps: ((cfg.baseline_slippage_bps as u64) * slip_mul_bps as u64 / 10_000)
            .min(u32::MAX as u64) as u32,
        paused,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> RegimeBoundConfig {
        RegimeBoundConfig {
            baseline_slice_q64: 1_000,
            baseline_interval_slots: 1_000,
            baseline_slippage_bps: 100,
        }
    }

    #[test]
    fn neutral_regime_returns_baseline() {
        let c = cadence_for_regime(MarketRegime::Neutral, &cfg()).unwrap();
        assert_eq!(c.slice_notional_q64, 1_000);
        assert_eq!(c.interval_slots, 1_000);
        assert_eq!(c.slippage_budget_bps, 100);
        assert!(!c.paused);
    }

    #[test]
    fn high_vol_shrinks_slice_and_widens_slippage() {
        let n = cadence_for_regime(MarketRegime::Neutral, &cfg()).unwrap();
        let h = cadence_for_regime(MarketRegime::HighVol, &cfg()).unwrap();
        assert!(h.slice_notional_q64 < n.slice_notional_q64);
        assert!(h.interval_slots > n.interval_slots);
        assert!(h.slippage_budget_bps > n.slippage_budget_bps);
    }

    #[test]
    fn accumulation_grows_slice_and_compresses_interval() {
        let n = cadence_for_regime(MarketRegime::Neutral, &cfg()).unwrap();
        let a = cadence_for_regime(MarketRegime::Accumulation, &cfg()).unwrap();
        assert!(a.slice_notional_q64 > n.slice_notional_q64);
        assert!(a.interval_slots < n.interval_slots);
    }

    #[test]
    fn crisis_pauses_dca() {
        let c = cadence_for_regime(MarketRegime::Crisis, &cfg()).unwrap();
        assert!(c.paused);
        assert_eq!(c.slice_notional_q64, 0);
    }

    #[test]
    fn zero_baseline_rejects() {
        let mut c = cfg();
        c.baseline_slice_q64 = 0;
        assert!(matches!(
            cadence_for_regime(MarketRegime::Neutral, &c),
            Err(CadenceError::ZeroBaselineSlice)
        ));
    }
}
