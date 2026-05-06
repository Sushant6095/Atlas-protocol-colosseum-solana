//! Cross-stable router (directive §8).
//!
//! Auto-aborts if `peg_deviation_bps > τ_peg_swap` on either leg —
//! no swap during a depeg.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Default peg deviation gate for stable swaps. 50 bps matches the
/// peg-deviation threshold from §6.1.
pub const TAU_PEG_SWAP_BPS: u32 = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct StableSwapRequest {
    pub treasury_entity_id: [u8; 32],
    pub from_mint: Pubkey,
    pub to_mint: Pubkey,
    pub amount_q64: u128,
    pub from_peg_deviation_bps: u32,
    pub to_peg_deviation_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct StableSwapQuote {
    pub from_mint: Pubkey,
    pub to_mint: Pubkey,
    pub amount_in_q64: u128,
    pub amount_out_q64: u128,
    pub expected_slippage_bps: u32,
    pub route_id: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum StableSwapError {
    #[error("from-leg peg deviation {got} bps > τ_peg_swap {tau} bps — refusing swap")]
    FromLegDepegged { got: u32, tau: u32 },
    #[error("to-leg peg deviation {got} bps > τ_peg_swap {tau} bps — refusing swap")]
    ToLegDepegged { got: u32, tau: u32 },
    #[error("from_mint == to_mint — no-op swap rejected")]
    SameMint,
    #[error("amount must be non-zero")]
    ZeroAmount,
}

/// Validate the swap request against the peg-deviation gate before
/// quoting. The caller still passes the request to the execution
/// registry (Phase 09 §4) — DFlow preferred for size, Jito for
/// atomicity. This function is the off-chain gate; the on-chain
/// guard is the same predicate at execution time.
pub fn route_stable_swap(req: &StableSwapRequest) -> Result<(), StableSwapError> {
    if req.from_mint == req.to_mint {
        return Err(StableSwapError::SameMint);
    }
    if req.amount_q64 == 0 {
        return Err(StableSwapError::ZeroAmount);
    }
    if req.from_peg_deviation_bps > TAU_PEG_SWAP_BPS {
        return Err(StableSwapError::FromLegDepegged {
            got: req.from_peg_deviation_bps,
            tau: TAU_PEG_SWAP_BPS,
        });
    }
    if req.to_peg_deviation_bps > TAU_PEG_SWAP_BPS {
        return Err(StableSwapError::ToLegDepegged {
            got: req.to_peg_deviation_bps,
            tau: TAU_PEG_SWAP_BPS,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(from: u32, to: u32) -> StableSwapRequest {
        StableSwapRequest {
            treasury_entity_id: [0u8; 32],
            from_mint: [1u8; 32],
            to_mint: [2u8; 32],
            amount_q64: 1_000,
            from_peg_deviation_bps: from,
            to_peg_deviation_bps: to,
        }
    }

    #[test]
    fn pegged_legs_pass() {
        route_stable_swap(&req(20, 30)).unwrap();
    }

    #[test]
    fn from_depeg_rejects() {
        assert!(matches!(
            route_stable_swap(&req(60, 0)),
            Err(StableSwapError::FromLegDepegged { .. })
        ));
    }

    #[test]
    fn to_depeg_rejects() {
        assert!(matches!(
            route_stable_swap(&req(0, 80)),
            Err(StableSwapError::ToLegDepegged { .. })
        ));
    }

    #[test]
    fn same_mint_rejects() {
        let mut r = req(0, 0);
        r.to_mint = r.from_mint;
        assert!(matches!(route_stable_swap(&r), Err(StableSwapError::SameMint)));
    }

    #[test]
    fn zero_amount_rejects() {
        let mut r = req(0, 0);
        r.amount_q64 = 0;
        assert!(matches!(route_stable_swap(&r), Err(StableSwapError::ZeroAmount)));
    }
}
