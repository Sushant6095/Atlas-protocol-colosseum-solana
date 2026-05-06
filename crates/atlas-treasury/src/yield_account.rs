//! PUSD Yield Account / "Treasury Checking" (directive §4).
//!
//! Hard liquidity policy: `min_idle_buffer_bps` (default 2000 = 20 %)
//! held as plain PUSD; remainder allocated by the standard pipeline.
//! Withdraw flow:
//!
//! * `requested ≤ idle_balance` → instant withdraw, single ix, no
//!   rebalance.
//! * else → triggers a withdrawal-targeted rebalance whose proof's
//!   public input includes the withdrawal target.
//!
//! Under defensive mode the buffer ratchets *up*, not down:
//! `effective = max(policy_buffer, defensive_buffer)`.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct YieldAccount {
    pub vault_id: Pubkey,
    pub policy_idle_buffer_bps: u32,
    /// Buffer required by defensive mode (Phase 01 §8). Zero when
    /// the system isn't in defensive mode.
    pub defensive_buffer_bps: u32,
    pub tvl_q64: u128,
    pub idle_balance_q64: u128,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WithdrawDecision {
    /// Single instruction, no rebalance, no proof — covered by idle.
    Instant,
    /// Withdrawal-targeted rebalance: proof public input commits to
    /// the withdrawal amount; the remaining-after-withdrawal
    /// allocation is what's proven.
    RebalanceTargeted,
    /// Vault is too thin to honour even after rebalancing — operator
    /// surfaces this to the user; no withdraw attempted.
    InsufficientFunds,
}

/// Effective buffer = `max(policy, defensive)`. Directive §4.2: under
/// stress the buffer ratchets up.
pub fn effective_idle_buffer_bps(policy_bps: u32, defensive_bps: u32) -> u32 {
    policy_bps.max(defensive_bps).min(10_000)
}

pub fn withdraw_decision(account: &YieldAccount, requested_q64: u128) -> WithdrawDecision {
    if requested_q64 == 0 {
        return WithdrawDecision::Instant;
    }
    if requested_q64 > account.tvl_q64 {
        return WithdrawDecision::InsufficientFunds;
    }
    if requested_q64 <= account.idle_balance_q64 {
        return WithdrawDecision::Instant;
    }
    WithdrawDecision::RebalanceTargeted
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account(idle: u128, tvl: u128) -> YieldAccount {
        YieldAccount {
            vault_id: [1u8; 32],
            policy_idle_buffer_bps: 2_000,
            defensive_buffer_bps: 0,
            tvl_q64: tvl,
            idle_balance_q64: idle,
        }
    }

    #[test]
    fn defensive_ratchets_buffer_up() {
        assert_eq!(effective_idle_buffer_bps(2_000, 0), 2_000);
        assert_eq!(effective_idle_buffer_bps(2_000, 6_000), 6_000);
        assert_eq!(effective_idle_buffer_bps(8_000, 6_000), 8_000);
    }

    #[test]
    fn buffer_capped_at_unit() {
        assert_eq!(effective_idle_buffer_bps(15_000, 0), 10_000);
    }

    #[test]
    fn small_withdraw_under_buffer_is_instant() {
        let a = account(2_000, 10_000);
        assert_eq!(withdraw_decision(&a, 1_500), WithdrawDecision::Instant);
    }

    #[test]
    fn large_withdraw_triggers_rebalance() {
        let a = account(2_000, 10_000);
        assert_eq!(
            withdraw_decision(&a, 5_000),
            WithdrawDecision::RebalanceTargeted
        );
    }

    #[test]
    fn withdraw_above_tvl_is_insufficient() {
        let a = account(2_000, 10_000);
        assert_eq!(
            withdraw_decision(&a, 100_000),
            WithdrawDecision::InsufficientFunds
        );
    }

    #[test]
    fn zero_withdraw_is_instant() {
        let a = account(0, 10_000);
        assert_eq!(withdraw_decision(&a, 0), WithdrawDecision::Instant);
    }
}
