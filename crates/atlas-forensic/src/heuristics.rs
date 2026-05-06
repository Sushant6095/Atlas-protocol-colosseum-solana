//! Detection heuristics (directive §1.1).

use crate::signal::{ForensicSignal, ProtocolId, Pubkey};
use std::collections::{BTreeMap, VecDeque};

#[derive(Clone, Copy, Debug)]
pub struct ForensicConfig {
    /// Threshold for `LargeStableExit` in Q64.64 (default: 100_000 stable units in Q64.64).
    pub large_stable_exit_threshold_q64: u128,
    /// Threshold for `WhaleEntry` notional.
    pub whale_entry_threshold_q64: u128,
    /// Liquidation count over 1-minute window that flags a cascade. 1 minute
    /// at 400 ms slots ≈ 150 slots.
    pub liquidation_cascade_count_1m: u32,
    pub liquidation_window_slots: u64,
    /// Smart-money migration: shift notional ≥ this fraction of wallet holdings.
    pub migration_min_fraction_bps: u32,
    /// Abnormal-withdrawal sigma threshold; directive: 5σ.
    pub abnormal_sigma_threshold: u32,
    /// Minimum samples before σ-based detection trusts its own variance.
    pub min_sigma_samples: u32,
}

impl Default for ForensicConfig {
    fn default() -> Self {
        Self {
            large_stable_exit_threshold_q64: 100_000_u128 << 64,
            whale_entry_threshold_q64: 100_000_u128 << 64,
            liquidation_cascade_count_1m: 8,
            liquidation_window_slots: 150,
            migration_min_fraction_bps: 5_000, // 50%
            abnormal_sigma_threshold: 5,
            min_sigma_samples: 32,
        }
    }
}

// ─── Welford online mean + variance ──────────────────────────────────────

#[derive(Clone, Copy, Debug, Default)]
pub struct WelfordOnline {
    pub n: u64,
    pub mean: f64,
    pub m2: f64,
}

impl WelfordOnline {
    pub fn push(&mut self, x: f64) {
        self.n = self.n.saturating_add(1);
        let delta = x - self.mean;
        self.mean += delta / self.n as f64;
        let delta2 = x - self.mean;
        self.m2 += delta * delta2;
    }

    pub fn variance(&self) -> f64 {
        if self.n < 2 {
            0.0
        } else {
            self.m2 / (self.n as f64 - 1.0)
        }
    }

    pub fn stddev(&self) -> f64 {
        self.variance().sqrt()
    }

    pub fn z_score(&self, x: f64) -> Option<f64> {
        let s = self.stddev();
        if s == 0.0 || self.n < 2 {
            None
        } else {
            Some((x - self.mean) / s)
        }
    }
}

// ─── Protocol flow tracker (LargeStableExit, WhaleEntry) ─────────────────

#[derive(Default)]
pub struct ProtocolFlowTracker;

impl ProtocolFlowTracker {
    pub fn check_large_exit(
        config: &ForensicConfig,
        protocol: ProtocolId,
        withdrawal_q64: u128,
        slot: u64,
    ) -> Option<ForensicSignal> {
        if withdrawal_q64 >= config.large_stable_exit_threshold_q64 {
            Some(ForensicSignal::LargeStableExit {
                protocol,
                amount_q64: withdrawal_q64,
                slot,
            })
        } else {
            None
        }
    }

    pub fn check_whale_entry(
        config: &ForensicConfig,
        protocol: ProtocolId,
        wallet: Pubkey,
        amount_q64: u128,
        slot: u64,
    ) -> Option<ForensicSignal> {
        if amount_q64 >= config.whale_entry_threshold_q64 {
            Some(ForensicSignal::WhaleEntry { protocol, wallet, amount_q64, slot })
        } else {
            None
        }
    }
}

// ─── Liquidation cascade tracker ─────────────────────────────────────────

pub struct LiquidationCascadeTracker {
    /// Per-protocol queue of (slot, notional) pairs trimmed to the window.
    by_protocol: BTreeMap<ProtocolId, VecDeque<(u64, u128)>>,
}

impl Default for LiquidationCascadeTracker {
    fn default() -> Self {
        Self { by_protocol: BTreeMap::new() }
    }
}

impl LiquidationCascadeTracker {
    pub fn record(
        &mut self,
        config: &ForensicConfig,
        protocol: ProtocolId,
        notional_q64: u128,
        slot: u64,
    ) -> Option<ForensicSignal> {
        let q = self.by_protocol.entry(protocol).or_default();
        q.push_back((slot, notional_q64));
        let cutoff = slot.saturating_sub(config.liquidation_window_slots);
        while let Some((s, _)) = q.front() {
            if *s < cutoff {
                q.pop_front();
            } else {
                break;
            }
        }
        let count_1m = q.len() as u32;
        let cumulative_notional: u128 = q.iter().map(|(_, n)| *n).sum();
        if count_1m >= config.liquidation_cascade_count_1m {
            Some(ForensicSignal::LiquidationCascade {
                protocol,
                count_1m,
                notional_q64: cumulative_notional,
                slot,
            })
        } else {
            None
        }
    }
}

// ─── Smart-money migration tracker ───────────────────────────────────────

pub struct SmartMoneyMigrationTracker {
    /// Per-(wallet, protocol) last-known holding in Q64.64.
    holdings: BTreeMap<(Pubkey, ProtocolId), u128>,
    /// Pending migration windows keyed by `(from, to)` collecting wallets that
    /// shifted `>= migration_min_fraction_bps` of holdings between them.
    pending: BTreeMap<(ProtocolId, ProtocolId), Vec<(Pubkey, u128)>>,
}

impl Default for SmartMoneyMigrationTracker {
    fn default() -> Self {
        Self { holdings: BTreeMap::new(), pending: BTreeMap::new() }
    }
}

impl SmartMoneyMigrationTracker {
    /// Update a wallet's holding in `protocol` and check whether the implied
    /// flow (vs. a sibling protocol) crosses the migration threshold.
    /// Returns a signal when a `(from, to)` migration accumulates ≥ 1 wallet.
    pub fn update(
        &mut self,
        config: &ForensicConfig,
        wallet: Pubkey,
        old_protocol: ProtocolId,
        new_protocol: ProtocolId,
        outflow_q64: u128,
        wallet_total_q64: u128,
        slot: u64,
    ) -> Option<ForensicSignal> {
        if old_protocol == new_protocol || wallet_total_q64 == 0 {
            return None;
        }
        let frac_bps = ((outflow_q64.saturating_mul(10_000)) / wallet_total_q64.max(1)).min(u32::MAX as u128) as u32;
        if frac_bps < config.migration_min_fraction_bps {
            return None;
        }
        // Update holdings.
        self.holdings.insert((wallet, old_protocol), 0);
        self.holdings.insert((wallet, new_protocol), wallet_total_q64);
        let entry = self.pending.entry((old_protocol, new_protocol)).or_default();
        if !entry.iter().any(|(w, _)| *w == wallet) {
            entry.push((wallet, outflow_q64));
        }
        // Emit a signal whenever the pending list has at least one wallet
        // that crossed the threshold; caller is responsible for clearing
        // (consumes the signal once).
        let wallets_vec: Vec<Pubkey> = entry.iter().map(|(w, _)| *w).collect();
        let notional: u128 = entry.iter().map(|(_, n)| *n).sum();
        Some(ForensicSignal::SmartMoneyMigration {
            from: old_protocol,
            to: new_protocol,
            wallets: wallets_vec,
            notional_q64: notional,
            slot,
        })
    }

    pub fn clear(&mut self, from: ProtocolId, to: ProtocolId) {
        self.pending.remove(&(from, to));
    }
}

// ─── Abnormal-withdrawal tracker (rolling 7d, Welford σ) ─────────────────

pub struct AbnormalWithdrawalTracker {
    by_protocol: BTreeMap<ProtocolId, WelfordOnline>,
}

impl Default for AbnormalWithdrawalTracker {
    fn default() -> Self {
        Self { by_protocol: BTreeMap::new() }
    }
}

impl AbnormalWithdrawalTracker {
    pub fn observe(
        &mut self,
        config: &ForensicConfig,
        protocol: ProtocolId,
        amount_q64: u128,
        slot: u64,
    ) -> Option<ForensicSignal> {
        let stats = self.by_protocol.entry(protocol).or_default();
        let z = stats.z_score(amount_q64 as f64);
        // Always learn from the observation, even if it's flagged.
        stats.push(amount_q64 as f64);
        if (stats.n as u32) < config.min_sigma_samples {
            return None;
        }
        let z = z?;
        if z >= config.abnormal_sigma_threshold as f64 {
            Some(ForensicSignal::AbnormalWithdrawal {
                protocol,
                amount_q64,
                sigma: z.floor().min(u32::MAX as f64) as u32,
                slot,
            })
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn welford_online_matches_offline_variance() {
        // Compare Welford to the textbook formula for [2,4,4,4,5,5,7,9].
        let mut w = WelfordOnline::default();
        for x in [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0] {
            w.push(x);
        }
        // Sample variance (N-1) = 4.5714... → σ ≈ 2.138
        assert!((w.stddev() - 2.138_089_935_299_395_4).abs() < 1e-9);
    }

    #[test]
    fn large_stable_exit_threshold() {
        let cfg = ForensicConfig::default();
        let small =
            ProtocolFlowTracker::check_large_exit(&cfg, ProtocolId(1), 100u128 << 64, 100);
        let big =
            ProtocolFlowTracker::check_large_exit(&cfg, ProtocolId(1), 200_000u128 << 64, 100);
        assert!(small.is_none());
        assert!(matches!(big, Some(ForensicSignal::LargeStableExit { .. })));
    }

    #[test]
    fn liquidation_cascade_fires_at_threshold() {
        let cfg = ForensicConfig::default();
        let mut t = LiquidationCascadeTracker::default();
        // 7 liquidations should NOT fire (threshold = 8).
        for i in 0..7 {
            assert!(t.record(&cfg, ProtocolId(1), 1_000, 100 + i).is_none());
        }
        // 8th fires.
        let signal = t.record(&cfg, ProtocolId(1), 1_000, 107).unwrap();
        assert!(matches!(signal, ForensicSignal::LiquidationCascade { count_1m: 8, .. }));
    }

    #[test]
    fn liquidation_window_evicts_old() {
        let cfg = ForensicConfig::default();
        let mut t = LiquidationCascadeTracker::default();
        // 7 liquidations at slot 0..=6.
        for i in 0..7 {
            t.record(&cfg, ProtocolId(1), 1_000, i);
        }
        // Move 200 slots forward — window (150) evicts everything; cascade
        // should NOT fire on a single fresh liquidation.
        let signal = t.record(&cfg, ProtocolId(1), 1_000, 300);
        assert!(signal.is_none());
    }

    #[test]
    fn migration_below_threshold_returns_none() {
        let cfg = ForensicConfig::default();
        let mut m = SmartMoneyMigrationTracker::default();
        // Wallet has 100 total, moves 30 (30%) — below 50% threshold.
        let r = m.update(&cfg, [1u8; 32], ProtocolId(1), ProtocolId(2), 30, 100, 100);
        assert!(r.is_none());
    }

    #[test]
    fn migration_above_threshold_emits_signal() {
        let cfg = ForensicConfig::default();
        let mut m = SmartMoneyMigrationTracker::default();
        // Wallet has 100 total, moves 80 (80%) — above 50% threshold.
        let r = m.update(&cfg, [1u8; 32], ProtocolId(1), ProtocolId(2), 80, 100, 100);
        assert!(matches!(r, Some(ForensicSignal::SmartMoneyMigration { .. })));
    }

    #[test]
    fn abnormal_withdrawal_fires_on_5_sigma() {
        let cfg = ForensicConfig::default();
        let mut t = AbnormalWithdrawalTracker::default();
        // Prime with 64 small withdrawals (well above min_sigma_samples=32).
        // Vary amounts modestly so Welford stddev > 0.
        for s in 0..64u64 {
            let amt = 1_000u128 + (s as u128 % 50);
            t.observe(&cfg, ProtocolId(1), amt, s);
        }
        // Now hit a 100x outlier — clearly > 5σ.
        let signal = t.observe(&cfg, ProtocolId(1), 1_000_000, 100);
        assert!(matches!(signal, Some(ForensicSignal::AbnormalWithdrawal { .. })));
    }

    #[test]
    fn abnormal_skipped_until_min_samples() {
        let cfg = ForensicConfig::default();
        let mut t = AbnormalWithdrawalTracker::default();
        // Even an extreme value won't fire before min_sigma_samples (32).
        for _ in 0..10 {
            assert!(t.observe(&cfg, ProtocolId(1), 1_000, 100).is_none());
        }
        assert!(t.observe(&cfg, ProtocolId(1), 100_000_000, 100).is_none());
    }
}
