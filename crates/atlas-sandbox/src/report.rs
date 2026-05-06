//! Report shapes shared by `backtest` and `compare` (directive §1.2).

use atlas_blackbox::BlackBoxRecord;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RebalanceSimResult {
    pub rebalance_index: u32,
    pub slot: u64,
    pub blackbox: BlackBoxRecord,
    /// Realised period return in bps (signed). Aggregated by [`AggregateMetrics`].
    pub period_return_bps: i32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct AggregateMetrics {
    pub realized_apy_bps: i32,
    pub mwrr_bps: i32,
    pub max_drawdown_bps: u32,
    pub calmar_ratio_bps: i32,
    pub sortino_ratio_bps: i32,
    pub defensive_share_bps: u32,
    pub rebalance_cost_bps: u32,
    pub rebalance_count: u32,
    pub aborted_count: u32,
    pub rejected_count: u32,
}

impl AggregateMetrics {
    /// Compute drawdown-based statistics from a series of period returns.
    /// Calmar = annualised_return / max_drawdown. Sortino = mean / downside_dev.
    /// Both are returned in bps; positive when the strategy beats its risk.
    pub fn from_period_returns(returns_bps: &[i32]) -> Self {
        if returns_bps.is_empty() {
            return Self::default();
        }
        // Cumulative equity curve, in bps relative to 10_000 starting NAV.
        let mut equity = 10_000_i64;
        let mut peak = equity;
        let mut max_dd = 0_i64;
        let mut sum_neg_sq: f64 = 0.0;
        let mut neg_count: f64 = 0.0;
        let mut sum: i64 = 0;
        for r in returns_bps {
            equity = equity.saturating_add(*r as i64);
            if equity > peak {
                peak = equity;
            } else {
                let dd = peak - equity;
                if dd > max_dd {
                    max_dd = dd;
                }
            }
            if *r < 0 {
                let f = *r as f64;
                sum_neg_sq += f * f;
                neg_count += 1.0;
            }
            sum += *r as i64;
        }
        let n = returns_bps.len() as i64;
        let mean = sum / n;
        let downside_dev = if neg_count > 0.0 {
            (sum_neg_sq / neg_count).sqrt()
        } else {
            0.0
        };
        let sortino = if downside_dev > 0.0 {
            ((mean as f64 / downside_dev) * 10_000.0) as i64
        } else {
            0
        };
        let calmar = if max_dd > 0 { (sum * 10_000) / max_dd } else { 0 };
        Self {
            realized_apy_bps: sum as i32,
            mwrr_bps: sum as i32,
            max_drawdown_bps: max_dd as u32,
            calmar_ratio_bps: calmar.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
            sortino_ratio_bps: sortino.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
            defensive_share_bps: 0,
            rebalance_cost_bps: 0,
            rebalance_count: returns_bps.len() as u32,
            aborted_count: 0,
            rejected_count: 0,
        }
    }
}

/// Stable report ID derived from `(strategy_hash, model_hash, vault_template_hash, slot_range)`.
pub fn report_id(
    strategy_hash: &[u8; 32],
    model_hash: &[u8; 32],
    vault_template_hash: &[u8; 32],
    start_slot: u64,
    end_slot: u64,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.sandbox.report.v1");
    h.update(strategy_hash);
    h.update(model_hash);
    h.update(vault_template_hash);
    h.update(&start_slot.to_le_bytes());
    h.update(&end_slot.to_le_bytes());
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_returns_summary_smoke() {
        // 3 wins of +100 bps each; one drawdown of -150 bps.
        let m = AggregateMetrics::from_period_returns(&[100, 100, -150, 100]);
        assert_eq!(m.realized_apy_bps, 150);
        assert_eq!(m.max_drawdown_bps, 150);
        assert_eq!(m.rebalance_count, 4);
    }

    #[test]
    fn aggregate_handles_no_drawdown() {
        let m = AggregateMetrics::from_period_returns(&[10, 20, 30]);
        assert_eq!(m.max_drawdown_bps, 0);
        assert_eq!(m.calmar_ratio_bps, 0);
    }

    #[test]
    fn report_id_changes_on_inputs() {
        let a = report_id(&[0u8; 32], &[1u8; 32], &[2u8; 32], 0, 100);
        let b = report_id(&[0u8; 32], &[1u8; 32], &[2u8; 32], 0, 200);
        assert_ne!(a, b);
    }

    #[test]
    fn report_id_is_deterministic() {
        let a = report_id(&[7u8; 32], &[1u8; 32], &[2u8; 32], 0, 100);
        let b = report_id(&[7u8; 32], &[1u8; 32], &[2u8; 32], 0, 100);
        assert_eq!(a, b);
    }
}
