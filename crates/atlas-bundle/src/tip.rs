//! Tip oracle (directive §7.1 last bullet).
//!
//! Tip amount is derived from the observed leader-slot tip
//! distribution, NOT a static constant (§11). Inputs: a sliding
//! window of (slot, tip_lamports) observations from recent landed
//! bundles; output: a quantile pick (default p75) clamped to a
//! per-vault cap.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TipCap {
    pub max_per_bundle_lamports: u64,
    pub max_per_24h_lamports: u64,
}

impl Default for TipCap {
    fn default() -> Self {
        Self {
            max_per_bundle_lamports: 100_000,        // 0.0001 SOL
            max_per_24h_lamports: 50_000_000,        // 0.05 SOL
        }
    }
}

#[derive(Clone, Debug, PartialEq, Default, Serialize, Deserialize)]
pub struct TipOracle {
    /// Sliding window — most recent observations at the back.
    observations: Vec<u64>,
    /// Maximum window size.
    window: usize,
    /// Quantile in bps (e.g. 7_500 = p75).
    quantile_bps: u32,
    /// Total tip spent in the rolling 24h window (lamports).
    spent_24h_lamports: u64,
}

impl TipOracle {
    pub fn new(window: usize, quantile_bps: u32) -> Self {
        Self {
            observations: Vec::with_capacity(window),
            window,
            quantile_bps,
            spent_24h_lamports: 0,
        }
    }

    pub fn record(&mut self, tip_lamports: u64) {
        self.observations.push(tip_lamports);
        let len = self.observations.len();
        if len > self.window {
            self.observations.drain(0..(len - self.window));
        }
    }

    /// Return the next-bundle tip recommendation, clamped to the cap.
    pub fn next_tip(&self, cap: TipCap) -> u64 {
        let raw = quantile(&self.observations, self.quantile_bps);
        let bundle_clamp = raw.min(cap.max_per_bundle_lamports);
        if self.spent_24h_lamports >= cap.max_per_24h_lamports {
            return 0;
        }
        let remaining = cap
            .max_per_24h_lamports
            .saturating_sub(self.spent_24h_lamports);
        bundle_clamp.min(remaining)
    }

    pub fn account_spend(&mut self, lamports: u64) {
        self.spent_24h_lamports = self.spent_24h_lamports.saturating_add(lamports);
    }

    pub fn rotate_24h(&mut self) {
        self.spent_24h_lamports = 0;
    }
}

/// Compute a quantile from the observation list. `quantile_bps` is in
/// `[0, 10_000]`. Returns 0 on empty input.
pub fn tip_from_distribution(observations: &[u64], quantile_bps: u32) -> u64 {
    quantile(observations, quantile_bps)
}

fn quantile(values: &[u64], quantile_bps: u32) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let mut sorted: Vec<u64> = values.to_vec();
    sorted.sort_unstable();
    let q = (quantile_bps.min(10_000) as usize) * (sorted.len() - 1);
    let idx = q / 10_000;
    sorted[idx]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantile_p50_of_uniform() {
        let v: Vec<u64> = (1..=11).collect();
        assert_eq!(tip_from_distribution(&v, 5_000), 6);
    }

    #[test]
    fn quantile_p75_higher_than_p50() {
        let v: Vec<u64> = (1..=101).collect();
        let p50 = tip_from_distribution(&v, 5_000);
        let p75 = tip_from_distribution(&v, 7_500);
        assert!(p75 > p50);
    }

    #[test]
    fn empty_observations_returns_zero() {
        assert_eq!(tip_from_distribution(&[], 7_500), 0);
    }

    #[test]
    fn next_tip_clamped_to_per_bundle() {
        let mut o = TipOracle::new(100, 7_500);
        for v in [50_000u64, 80_000, 200_000, 300_000] {
            o.record(v);
        }
        let cap = TipCap { max_per_bundle_lamports: 100_000, max_per_24h_lamports: 1_000_000 };
        assert!(o.next_tip(cap) <= 100_000);
    }

    #[test]
    fn next_tip_respects_24h_cap() {
        let mut o = TipOracle::new(10, 7_500);
        o.record(50_000);
        o.account_spend(900_000);
        let cap = TipCap { max_per_bundle_lamports: 200_000, max_per_24h_lamports: 1_000_000 };
        // Remaining budget = 100_000 → floors the recommendation.
        assert!(o.next_tip(cap) <= 100_000);
        // After cap exhaustion, recommendation is 0.
        o.account_spend(100_000);
        assert_eq!(o.next_tip(cap), 0);
    }

    #[test]
    fn window_evicts_oldest_observations() {
        let mut o = TipOracle::new(3, 5_000);
        for v in [1u64, 2, 3, 4] {
            o.record(v);
        }
        // observations should be [2, 3, 4] now.
        assert_eq!(o.observations.len(), 3);
        assert_eq!(o.observations[0], 2);
    }
}
