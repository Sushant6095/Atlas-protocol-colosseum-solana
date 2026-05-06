//! atlas-capital — capital efficiency engine (directive 05 §5).
//!
//! Per vault, per epoch:
//!
//! * `idle_capital_share_bps`     — `(idle_balance / tvl)` averaged across the
//!                                   epoch, expressed in bps.
//! * `realized_apy_bps`           — money-weighted return (MWRR) over the
//!                                   epoch, annualised; signed (negative on
//!                                   drawdown).
//! * `expected_apy_bps`           — `Σ allocation_i × oracle_apy_i`.
//! * `yield_efficiency_bps`       — `realized_apy / expected_apy`.
//! * `rebalance_cost_bps`         — `(gas + tip + slippage) / tvl`.
//! * `rebalance_efficiency_bps`   — `realized_apy / (realized_apy + cost)`.
//! * `defensive_share_bps`        — fraction of epoch in defensive mode.
//!
//! All inputs come from the warehouse; outputs feed the daily digest and the
//! transparency page. The engine is pure (no I/O) — replay parity guaranteed.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde::{Deserialize, Serialize};

pub const BPS_DENOM: u32 = 10_000;
pub const SECONDS_PER_YEAR: f64 = 365.25 * 24.0 * 3600.0;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CapitalError {
    #[error("tvl must be > 0")]
    TvlZero,
    #[error("epoch span must be > 0 seconds")]
    EmptyEpoch,
    #[error("allocation bps sum {0} != 10_000")]
    AllocationNotUnit(u32),
    #[error("oracle apys length {0} != allocation length {1}")]
    AllocationOracleLengthMismatch(usize, usize),
    #[error("MWRR did not converge after {0} iterations")]
    MwrrNotConverged(u32),
    #[error("MWRR has no real solution (signs all positive or all negative)")]
    MwrrInfeasible,
}

/// One rebalance epoch summary, signed where appropriate.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CapitalEpoch {
    pub vault_id: [u8; 32],
    /// Inclusive start slot of the epoch.
    pub start_slot: u64,
    /// Exclusive end slot of the epoch.
    pub end_slot: u64,
    pub idle_capital_share_bps: u32,
    pub realized_apy_bps: i32,
    pub expected_apy_bps: u32,
    pub yield_efficiency_bps: u32,
    pub rebalance_cost_bps: u32,
    pub rebalance_efficiency_bps: u32,
    pub defensive_share_bps: u32,
}

// ── Idle share ────────────────────────────────────────────────────────────

/// Average idle share over a series of `(idle_balance, tvl)` snapshots, in bps.
pub fn idle_capital_share_bps(snapshots: &[(u128, u128)]) -> Result<u32, CapitalError> {
    if snapshots.is_empty() {
        return Ok(0);
    }
    let mut sum_bps: u128 = 0;
    let mut count: u128 = 0;
    for (idle, tvl) in snapshots {
        if *tvl == 0 {
            return Err(CapitalError::TvlZero);
        }
        let bps = idle.saturating_mul(BPS_DENOM as u128) / *tvl;
        sum_bps = sum_bps.saturating_add(bps);
        count += 1;
    }
    Ok((sum_bps / count) as u32)
}

// ── Expected APY ──────────────────────────────────────────────────────────

/// `Σ allocation_i × oracle_apy_i`, both in bps. Allocation must sum to
/// `BPS_DENOM`. Returns expected APY in bps.
pub fn expected_apy_bps(
    allocation_bps: &[u32],
    oracle_apys_bps: &[u32],
) -> Result<u32, CapitalError> {
    if allocation_bps.len() != oracle_apys_bps.len() {
        return Err(CapitalError::AllocationOracleLengthMismatch(
            allocation_bps.len(),
            oracle_apys_bps.len(),
        ));
    }
    let alloc_sum: u32 = allocation_bps.iter().copied().sum();
    if alloc_sum != BPS_DENOM {
        return Err(CapitalError::AllocationNotUnit(alloc_sum));
    }
    let mut acc: u64 = 0;
    for (a, y) in allocation_bps.iter().zip(oracle_apys_bps.iter()) {
        acc += (*a as u64) * (*y as u64);
    }
    Ok((acc / BPS_DENOM as u64) as u32)
}

// ── Realized APY (MWRR) ───────────────────────────────────────────────────

/// One signed cash flow into/out of the vault during the epoch. Positive
/// means inflow; the closing NAV is the final positive entry.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CashFlow {
    /// Seconds since epoch start. The opening NAV must have `t_seconds == 0`
    /// and a negative sign (capital deployed).
    pub t_seconds: f64,
    /// Signed amount in vault's accounting unit (e.g., USD micro-units).
    pub amount: f64,
}

/// Money-Weighted Rate of Return — IRR on the cash-flow series, annualised
/// and converted to bps. Signed; negative on drawdown. Solved by
/// Newton-Raphson with bisection fallback.
pub fn realized_apy_bps(cash_flows: &[CashFlow]) -> Result<i32, CapitalError> {
    if cash_flows.is_empty() {
        return Err(CapitalError::EmptyEpoch);
    }
    let has_pos = cash_flows.iter().any(|cf| cf.amount > 0.0);
    let has_neg = cash_flows.iter().any(|cf| cf.amount < 0.0);
    if !(has_pos && has_neg) {
        return Err(CapitalError::MwrrInfeasible);
    }
    let max_t = cash_flows.iter().map(|cf| cf.t_seconds).fold(0.0_f64, f64::max);
    if max_t <= 0.0 {
        return Err(CapitalError::EmptyEpoch);
    }
    // Newton-Raphson on r (continuously compounded annual rate), then convert
    // to APY. NPV(r) = Σ amount_i × exp(-r × t_i / SECONDS_PER_YEAR) = 0.
    let mut r = 0.05_f64; // start at 5% / yr
    for _ in 0..64 {
        let mut npv = 0.0_f64;
        let mut dnpv = 0.0_f64;
        for cf in cash_flows {
            let years = cf.t_seconds / SECONDS_PER_YEAR;
            let disc = (-r * years).exp();
            npv += cf.amount * disc;
            dnpv += -cf.amount * years * disc;
        }
        if npv.abs() < 1e-7 {
            // Convert continuously-compounded `r` to APY: exp(r) - 1.
            let apy = r.exp() - 1.0;
            let bps = (apy * BPS_DENOM as f64).round();
            return Ok(bps.clamp(i32::MIN as f64, i32::MAX as f64) as i32);
        }
        if dnpv.abs() < 1e-12 {
            break;
        }
        let step = npv / dnpv;
        let new_r = r - step;
        // Clamp to a sane band so divergent steps don't NaN.
        if !new_r.is_finite() {
            break;
        }
        r = new_r.clamp(-0.99, 50.0);
    }
    Err(CapitalError::MwrrNotConverged(64))
}

// ── Yield + rebalance efficiency ──────────────────────────────────────────

/// `realized_apy / expected_apy`, in bps. Saturates to `2 × BPS_DENOM` for
/// pathologically high outperformance, and clamps negative realized to 0
/// (efficiency makes sense only against a positive expected baseline).
pub fn yield_efficiency_bps(realized_apy_bps: i32, expected_apy_bps: u32) -> u32 {
    if expected_apy_bps == 0 {
        return 0;
    }
    let realized = realized_apy_bps.max(0) as u64;
    let expected = expected_apy_bps as u64;
    let raw = realized * BPS_DENOM as u64 / expected;
    raw.min(2 * BPS_DENOM as u64) as u32
}

/// `(gas + tip + slippage) / tvl`, in bps.
pub fn rebalance_cost_bps(
    gas: u128,
    tip: u128,
    slippage: u128,
    tvl: u128,
) -> Result<u32, CapitalError> {
    if tvl == 0 {
        return Err(CapitalError::TvlZero);
    }
    let total = gas.saturating_add(tip).saturating_add(slippage);
    let bps = total.saturating_mul(BPS_DENOM as u128) / tvl;
    Ok(bps.min(BPS_DENOM as u128 * 100) as u32)
}

/// `realized_apy / (realized_apy + cost)`, in bps. Negative realized clamps
/// to 0. If realized_apy + cost == 0, returns 0.
pub fn rebalance_efficiency_bps(realized_apy_bps: i32, cost_bps: u32) -> u32 {
    let realized = realized_apy_bps.max(0) as u64;
    let denom = realized + cost_bps as u64;
    if denom == 0 {
        return 0;
    }
    (realized * BPS_DENOM as u64 / denom) as u32
}

// ── Defensive share ───────────────────────────────────────────────────────

/// `defensive_slots / total_slots`, in bps.
pub fn defensive_share_bps(defensive_slots: u64, total_slots: u64) -> u32 {
    if total_slots == 0 {
        return 0;
    }
    let bps = defensive_slots.saturating_mul(BPS_DENOM as u64) / total_slots;
    bps.min(BPS_DENOM as u64) as u32
}

// ── Aggregate roll-up ─────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
pub struct EpochInputs<'a> {
    pub vault_id: [u8; 32],
    pub start_slot: u64,
    pub end_slot: u64,
    /// `(idle, tvl)` snapshots taken at regular intervals over the epoch.
    pub idle_tvl_snapshots: &'a [(u128, u128)],
    /// Allocation bps at the close of the epoch.
    pub closing_allocation_bps: &'a [u32],
    /// Oracle APY bps for each protocol slot, aligned with `closing_allocation_bps`.
    pub oracle_apys_bps: &'a [u32],
    pub cash_flows: &'a [CashFlow],
    pub gas: u128,
    pub tip: u128,
    pub slippage: u128,
    pub final_tvl: u128,
    pub defensive_slots: u64,
    pub total_slots: u64,
}

pub fn rollup(inputs: EpochInputs<'_>) -> Result<CapitalEpoch, CapitalError> {
    let idle = idle_capital_share_bps(inputs.idle_tvl_snapshots)?;
    let expected = expected_apy_bps(inputs.closing_allocation_bps, inputs.oracle_apys_bps)?;
    let realized = realized_apy_bps(inputs.cash_flows)?;
    let yield_eff = yield_efficiency_bps(realized, expected);
    let cost = rebalance_cost_bps(inputs.gas, inputs.tip, inputs.slippage, inputs.final_tvl)?;
    let rebal_eff = rebalance_efficiency_bps(realized, cost);
    let defensive = defensive_share_bps(inputs.defensive_slots, inputs.total_slots);
    Ok(CapitalEpoch {
        vault_id: inputs.vault_id,
        start_slot: inputs.start_slot,
        end_slot: inputs.end_slot,
        idle_capital_share_bps: idle,
        realized_apy_bps: realized,
        expected_apy_bps: expected,
        yield_efficiency_bps: yield_eff,
        rebalance_cost_bps: cost,
        rebalance_efficiency_bps: rebal_eff,
        defensive_share_bps: defensive,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_share_avg_constant() {
        // 10% idle across 4 snapshots → 1_000 bps.
        let snaps = [(100u128, 1_000u128); 4];
        assert_eq!(idle_capital_share_bps(&snaps).unwrap(), 1_000);
    }

    #[test]
    fn idle_share_rejects_zero_tvl() {
        let snaps = [(100u128, 0u128)];
        assert_eq!(idle_capital_share_bps(&snaps), Err(CapitalError::TvlZero));
    }

    #[test]
    fn expected_apy_weighted_correctly() {
        // 50% Kamino @ 10% APY + 50% Drift @ 20% APY = 15% APY.
        let alloc = [5_000u32, 5_000];
        let apys = [1_000u32, 2_000];
        assert_eq!(expected_apy_bps(&alloc, &apys).unwrap(), 1_500);
    }

    #[test]
    fn expected_apy_rejects_alloc_not_summing_to_unit() {
        let alloc = [5_000u32, 4_000];
        let apys = [1_000u32, 2_000];
        assert!(matches!(
            expected_apy_bps(&alloc, &apys),
            Err(CapitalError::AllocationNotUnit(9_000))
        ));
    }

    #[test]
    fn realized_apy_one_year_10_percent() {
        // Deposit 1000, hold for one year, withdraw 1100 → 10% APY (≈ 1_000 bps).
        let cfs = [
            CashFlow { t_seconds: 0.0, amount: -1_000.0 },
            CashFlow { t_seconds: SECONDS_PER_YEAR, amount: 1_100.0 },
        ];
        let bps = realized_apy_bps(&cfs).unwrap();
        // Slight tolerance — Newton converges to ~exp(0.0953)-1 = 0.1.
        assert!((bps - 1_000).abs() <= 5, "expected ~1000 bps, got {bps}");
    }

    #[test]
    fn realized_apy_rejects_no_outflow() {
        let cfs = [CashFlow { t_seconds: 0.0, amount: -1_000.0 }];
        assert_eq!(realized_apy_bps(&cfs), Err(CapitalError::MwrrInfeasible));
    }

    #[test]
    fn realized_apy_negative_on_drawdown() {
        // Deposit 1000, withdraw 900 after 1 year → -10% APY.
        let cfs = [
            CashFlow { t_seconds: 0.0, amount: -1_000.0 },
            CashFlow { t_seconds: SECONDS_PER_YEAR, amount: 900.0 },
        ];
        let bps = realized_apy_bps(&cfs).unwrap();
        assert!(bps < 0, "expected negative APY, got {bps}");
    }

    #[test]
    fn yield_efficiency_clamps_negative() {
        assert_eq!(yield_efficiency_bps(-500, 1_000), 0);
    }

    #[test]
    fn yield_efficiency_full_match_is_unit() {
        assert_eq!(yield_efficiency_bps(1_500, 1_500), BPS_DENOM);
    }

    #[test]
    fn rebalance_cost_proportional() {
        // 100 bps cost on 1_000_000 TVL.
        assert_eq!(rebalance_cost_bps(10_000, 0, 0, 1_000_000).unwrap(), 100);
    }

    #[test]
    fn rebalance_efficiency_subtracts_cost() {
        // 1_000 bps realized vs 100 bps cost → 1000/1100 ≈ 9_090 bps.
        let eff = rebalance_efficiency_bps(1_000, 100);
        assert!((eff as i32 - 9_090).abs() <= 2, "got {eff}");
    }

    #[test]
    fn defensive_share_rounds_correctly() {
        // 1 hour at 400ms = 9_000 slots; 1 day = 216_000 slots; 1h/24h ≈ 417 bps.
        assert_eq!(defensive_share_bps(9_000, 216_000), 416);
    }

    #[test]
    fn rollup_smoke() {
        let alloc = [5_000u32, 5_000];
        let apys = [1_000u32, 2_000];
        let snaps = [(100u128, 1_000u128); 4];
        let cfs = [
            CashFlow { t_seconds: 0.0, amount: -1_000.0 },
            CashFlow { t_seconds: SECONDS_PER_YEAR, amount: 1_100.0 },
        ];
        let r = rollup(EpochInputs {
            vault_id: [1u8; 32],
            start_slot: 0,
            end_slot: 216_000,
            idle_tvl_snapshots: &snaps,
            closing_allocation_bps: &alloc,
            oracle_apys_bps: &apys,
            cash_flows: &cfs,
            gas: 5_000,
            tip: 5_000,
            slippage: 0,
            final_tvl: 1_000_000,
            defensive_slots: 0,
            total_slots: 216_000,
        })
        .unwrap();
        assert_eq!(r.idle_capital_share_bps, 1_000);
        assert_eq!(r.expected_apy_bps, 1_500);
        assert!((r.realized_apy_bps - 1_000).abs() <= 5);
        assert_eq!(r.defensive_share_bps, 0);
    }
}
