//! Cashflow runway forecast (directive §5).
//!
//! `runway_p10_days` = worst-case (10th percentile) days of runway
//! given expected outflow distribution. Atlas's risk engine consumes
//! this to **tighten** allocations when runway is short.
//!
//! Critical invariant: this signal can only tighten, never loosen,
//! the allocation. Loosening would let off-chain Dodo data weaken
//! the proof's guarantees.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunwayInputs {
    pub treasury_id: Pubkey,
    pub as_of_slot: u64,
    /// Days of horizon to forecast, e.g. 90.
    pub horizon_days: u16,
    /// Sorted ascending — sample distribution of expected outflows
    /// per day. Median = sorted[len/2]. p90 = sorted[len * 0.9].
    pub outflow_samples_q64_per_day: Vec<u128>,
    pub avg_inflow_q64_per_day: u128,
    pub current_balance_q64: u128,
    /// Provenance — Dodo execution ids + warehouse slots.
    pub sources: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunwayForecast {
    pub treasury_id: Pubkey,
    pub as_of_slot: u64,
    pub horizon_days: u16,
    /// 10th percentile (worst case among modeled).
    pub runway_p10_days: u16,
    /// 50th percentile (median).
    pub runway_p50_days: u16,
    pub confidence_bps: u32,
    pub sources: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunwayConstraintTier {
    /// > 180 days runway. Strategy commitment respected fully.
    Healthy,
    /// 90 - 180 days. Tighten aggressive allocations 30 %.
    Cautious,
    /// 30 - 90 days. Tighten 60 %; defensive vector primed.
    Constrained,
    /// < 30 days. Force defensive vector; only critical payouts execute.
    Critical,
}

pub fn forecast_runway(inputs: &RunwayInputs) -> RunwayForecast {
    let mut samples = inputs.outflow_samples_q64_per_day.clone();
    samples.sort();
    let p10_outflow = quantile(&samples, 9_000); // worst-case = high outflow → 90th pct
    let p50_outflow = quantile(&samples, 5_000);
    let net_p10 = saturating_sub(p10_outflow, inputs.avg_inflow_q64_per_day);
    let net_p50 = saturating_sub(p50_outflow, inputs.avg_inflow_q64_per_day);
    let runway_p10_days = if net_p10 == 0 {
        u16::MAX
    } else {
        ((inputs.current_balance_q64 / net_p10) as u64).min(u16::MAX as u64) as u16
    };
    let runway_p50_days = if net_p50 == 0 {
        u16::MAX
    } else {
        ((inputs.current_balance_q64 / net_p50) as u64).min(u16::MAX as u64) as u16
    };
    // Confidence scales with sample count — capped at 9_500 because
    // off-chain data can never be 100% certain.
    let confidence_bps = ((samples.len() as u64 * 100).min(9_500)) as u32;
    RunwayForecast {
        treasury_id: inputs.treasury_id,
        as_of_slot: inputs.as_of_slot,
        horizon_days: inputs.horizon_days,
        runway_p10_days,
        runway_p50_days,
        confidence_bps,
        sources: inputs.sources.clone(),
    }
}

/// Map a forecast's `runway_p10_days` to the corresponding allocation
/// constraint tier. The risk engine uses this as an **override input
/// that can only tighten, never loosen** the allocation.
pub fn runway_constraint(p10_days: u16) -> RunwayConstraintTier {
    if p10_days >= 180 {
        RunwayConstraintTier::Healthy
    } else if p10_days >= 90 {
        RunwayConstraintTier::Cautious
    } else if p10_days >= 30 {
        RunwayConstraintTier::Constrained
    } else {
        RunwayConstraintTier::Critical
    }
}

fn quantile(sorted: &[u128], quantile_bps: u32) -> u128 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = (sorted.len() - 1) * (quantile_bps.min(10_000) as usize) / 10_000;
    sorted[idx]
}

fn saturating_sub(a: u128, b: u128) -> u128 {
    a.saturating_sub(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inputs(balance: u128, samples: Vec<u128>, inflow: u128) -> RunwayInputs {
        RunwayInputs {
            treasury_id: [1u8; 32],
            as_of_slot: 100,
            horizon_days: 90,
            outflow_samples_q64_per_day: samples,
            avg_inflow_q64_per_day: inflow,
            current_balance_q64: balance,
            sources: vec!["dodo-sim:exec_x".into(), "atlas-warehouse:slot_n".into()],
        }
    }

    #[test]
    fn high_balance_long_runway() {
        // Balance 1_000_000, daily outflow median 1_000, inflow 0 → 1000 days p50.
        let r = forecast_runway(&inputs(1_000_000, vec![500, 1_000, 1_500], 0));
        assert!(r.runway_p50_days >= 500);
    }

    #[test]
    fn p10_below_p50() {
        // p90 of outflow = high outflow → p10 of runway is shorter.
        let r = forecast_runway(&inputs(1_000_000, vec![100, 500, 1_000, 5_000, 10_000], 0));
        assert!(r.runway_p10_days <= r.runway_p50_days);
    }

    #[test]
    fn inflows_extend_runway() {
        let no_inflow = forecast_runway(&inputs(10_000, vec![1_000], 0));
        let with_inflow = forecast_runway(&inputs(10_000, vec![1_000], 500));
        assert!(with_inflow.runway_p50_days > no_inflow.runway_p50_days);
    }

    #[test]
    fn inflows_above_outflows_yield_max_runway() {
        let r = forecast_runway(&inputs(10_000, vec![500], 1_000));
        assert_eq!(r.runway_p50_days, u16::MAX);
    }

    #[test]
    fn confidence_capped_at_9500() {
        let many_samples: Vec<u128> = (1..=200).map(|i| i as u128).collect();
        let r = forecast_runway(&inputs(1_000_000, many_samples, 0));
        assert_eq!(r.confidence_bps, 9_500);
    }

    #[test]
    fn constraint_tiers() {
        assert_eq!(runway_constraint(365), RunwayConstraintTier::Healthy);
        assert_eq!(runway_constraint(120), RunwayConstraintTier::Cautious);
        assert_eq!(runway_constraint(60), RunwayConstraintTier::Constrained);
        assert_eq!(runway_constraint(15), RunwayConstraintTier::Critical);
    }
}
