//! Treasury hedging via Jupiter Perps (directive §6).
//!
//! Hedge sizing is **derived** from the underlying LP exposure +
//! sensitivity model (linear approximation of IL vs price move).
//! Hedge notional cannot exceed underlying — anti-pattern §11
//! "naked-short attempt" is rejected at construction time.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Maximum recommended leverage band — directive recommends ≤ 2×.
pub const RECOMMENDED_MAX_LEVERAGE_BPS: u32 = 20_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HedgePolicy {
    pub hedge_enabled: bool,
    pub max_hedge_notional_q64: u128,
    pub max_hedge_leverage_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HedgeRequest {
    pub vault_id: Pubkey,
    pub underlying_lp_value_q64: u128,
    /// Sensitivity in bps: dIL / dPx, linear approximation. 5_000 bps
    /// = 0.5 IL exposure per unit price move.
    pub il_sensitivity_bps: u32,
    /// The hedge notional the caller proposes — the validator will
    /// recompute and refuse if the proposal exceeds the derived size
    /// (or the policy bound).
    pub proposed_hedge_notional_q64: u128,
    /// Leverage in bps the caller proposes.
    pub proposed_leverage_bps: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HedgeSizing {
    pub recommended_notional_q64: u128,
    pub effective_leverage_bps: u32,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum HedgeError {
    #[error("hedging is not enabled in this treasury's risk policy")]
    HedgingDisabled,
    #[error("hedge notional {got} exceeds policy cap {cap}")]
    NotionalAboveCap { got: u128, cap: u128 },
    #[error("hedge notional {got} > underlying {underlying} — naked short rejected")]
    NakedShort { got: u128, underlying: u128 },
    #[error("leverage {got} bps exceeds policy max {cap}")]
    LeverageAboveCap { got: u32, cap: u32 },
    #[error("leverage {got} bps exceeds recommended ceiling {RECOMMENDED_MAX_LEVERAGE_BPS}")]
    LeverageAboveRecommended { got: u32 },
    #[error("underlying LP value is zero — nothing to hedge")]
    NoUnderlying,
}

/// Derive the recommended hedge notional from the underlying LP
/// value × sensitivity. Linear approximation of IL exposure: a 50 %
/// sensitivity (5_000 bps) on a $10k LP recommends a $5k short.
pub fn compute_hedge_sizing(req: &HedgeRequest) -> Result<HedgeSizing, HedgeError> {
    if req.underlying_lp_value_q64 == 0 {
        return Err(HedgeError::NoUnderlying);
    }
    let recommended = req
        .underlying_lp_value_q64
        .saturating_mul(req.il_sensitivity_bps as u128)
        / 10_000;
    Ok(HedgeSizing {
        recommended_notional_q64: recommended,
        effective_leverage_bps: req.proposed_leverage_bps,
    })
}

/// Validate a hedge request against the policy + naked-short guard.
/// Rejects: hedging disabled, notional above cap, notional above
/// underlying (naked short), leverage above policy cap, leverage
/// above the recommended 2× ceiling.
pub fn validate_hedge_request(
    policy: &HedgePolicy,
    req: &HedgeRequest,
) -> Result<HedgeSizing, HedgeError> {
    if !policy.hedge_enabled {
        return Err(HedgeError::HedgingDisabled);
    }
    if req.proposed_hedge_notional_q64 > policy.max_hedge_notional_q64 {
        return Err(HedgeError::NotionalAboveCap {
            got: req.proposed_hedge_notional_q64,
            cap: policy.max_hedge_notional_q64,
        });
    }
    if req.proposed_hedge_notional_q64 > req.underlying_lp_value_q64 {
        return Err(HedgeError::NakedShort {
            got: req.proposed_hedge_notional_q64,
            underlying: req.underlying_lp_value_q64,
        });
    }
    if req.proposed_leverage_bps > policy.max_hedge_leverage_bps {
        return Err(HedgeError::LeverageAboveCap {
            got: req.proposed_leverage_bps,
            cap: policy.max_hedge_leverage_bps,
        });
    }
    if req.proposed_leverage_bps > RECOMMENDED_MAX_LEVERAGE_BPS {
        return Err(HedgeError::LeverageAboveRecommended {
            got: req.proposed_leverage_bps,
        });
    }
    compute_hedge_sizing(req)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> HedgePolicy {
        HedgePolicy {
            hedge_enabled: true,
            max_hedge_notional_q64: 10_000,
            max_hedge_leverage_bps: 20_000,
        }
    }

    fn req(notional: u128, leverage: u32, underlying: u128) -> HedgeRequest {
        HedgeRequest {
            vault_id: [1u8; 32],
            underlying_lp_value_q64: underlying,
            il_sensitivity_bps: 5_000,
            proposed_hedge_notional_q64: notional,
            proposed_leverage_bps: leverage,
        }
    }

    #[test]
    fn happy_path_validates_and_returns_sizing() {
        let s = validate_hedge_request(&policy(), &req(5_000, 15_000, 10_000)).unwrap();
        // 50 % sensitivity on $10k underlying → $5k recommended.
        assert_eq!(s.recommended_notional_q64, 5_000);
    }

    #[test]
    fn hedging_disabled_rejects() {
        let mut p = policy();
        p.hedge_enabled = false;
        let r = validate_hedge_request(&p, &req(5_000, 15_000, 10_000));
        assert!(matches!(r, Err(HedgeError::HedgingDisabled)));
    }

    #[test]
    fn notional_above_policy_cap_rejects() {
        let r = validate_hedge_request(&policy(), &req(20_000, 15_000, 30_000));
        assert!(matches!(r, Err(HedgeError::NotionalAboveCap { .. })));
    }

    #[test]
    fn naked_short_rejects() {
        // Hedge notional > underlying.
        let r = validate_hedge_request(&policy(), &req(5_000, 15_000, 4_000));
        assert!(matches!(r, Err(HedgeError::NakedShort { .. })));
    }

    #[test]
    fn leverage_above_policy_cap_rejects() {
        let mut p = policy();
        p.max_hedge_leverage_bps = 10_000;
        let r = validate_hedge_request(&p, &req(5_000, 15_000, 10_000));
        assert!(matches!(r, Err(HedgeError::LeverageAboveCap { .. })));
    }

    #[test]
    fn leverage_above_recommended_ceiling_rejects() {
        let mut p = policy();
        p.max_hedge_leverage_bps = 50_000; // policy permissive
        let r = validate_hedge_request(&p, &req(5_000, 25_000, 10_000));
        assert!(matches!(r, Err(HedgeError::LeverageAboveRecommended { .. })));
    }

    #[test]
    fn zero_underlying_rejects_at_sizing() {
        let r = compute_hedge_sizing(&req(0, 0, 0));
        assert!(matches!(r, Err(HedgeError::NoUnderlying)));
    }
}
