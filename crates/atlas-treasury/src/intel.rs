//! Stablecoin intelligence triggers (directive §6).
//!
//! Four signals extending Phase 02 CEP + Phase 05 alerts:
//!
//! * `PegDeviation` — peg drift past `τ_peg = 50 bps` for K = 8 slots.
//! * `StableFlowSpike` — 5σ flow on a tracked protocol.
//! * `StablePoolDepthCollapse` — depth at ±25 bps drops > 40 % in 60 s.
//! * `IssuerEvent` — issuer-side activity (mint spike, burn spike,
//!   authority change).
//!
//! These are **monitoring + alert** signals, not commitment inputs.
//! The commitment-bound peg signal is computed from on-chain DEX
//! TWAPs (directive §6.3).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub const TAU_PEG_BPS: u32 = 50;
pub const TAU_PEG_K_SLOTS: u32 = 8;
pub const TAU_DEPTH_DROP_BPS: u32 = 4_000; // 40 %
pub const TAU_DEPTH_WINDOW_SLOTS: u64 = 150; // ≈ 60 s @ 400 ms

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StableFlowDirection {
    Inflow,
    Outflow,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IssuerEventKind {
    MintMintedSpike,
    MintBurnedSpike,
    AuthorityChange,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum StableIntelSignal {
    PegDeviation { mint: Pubkey, deviation_bps: u32, source: String, slot: u64 },
    StableFlowSpike { mint: Pubkey, direction: StableFlowDirection, notional_q64: u128, window_ms: u32, slot: u64 },
    StablePoolDepthCollapse { pool: Pubkey, mint: Pubkey, depth_drop_bps: u32, slot: u64 },
    IssuerEvent { mint: Pubkey, kind: IssuerEventKind, slot: u64 },
}

// ── Peg deviation tracker ────────────────────────────────────────────

#[derive(Default)]
pub struct PegDeviationTracker {
    /// Per-mint sliding window of (slot, deviation_bps) pairs. We
    /// emit when the last K observations all exceed τ.
    by_mint: std::collections::BTreeMap<Pubkey, VecDeque<(u64, u32)>>,
}

impl PegDeviationTracker {
    pub fn new() -> Self { Self::default() }

    pub fn observe(&mut self, mint: Pubkey, slot: u64, deviation_bps: u32, source: &str)
        -> Option<StableIntelSignal>
    {
        let q = self.by_mint.entry(mint).or_default();
        q.push_back((slot, deviation_bps));
        while q.len() > TAU_PEG_K_SLOTS as usize {
            q.pop_front();
        }
        if q.len() == TAU_PEG_K_SLOTS as usize
            && q.iter().all(|(_, d)| *d > TAU_PEG_BPS)
        {
            Some(StableIntelSignal::PegDeviation {
                mint,
                deviation_bps,
                source: source.to_string(),
                slot,
            })
        } else {
            None
        }
    }
}

// ── Flow spike tracker (5σ over 24h trailing) ────────────────────────

#[derive(Default)]
pub struct StableFlowSpikeTracker {
    /// Welford-style running stats per mint × direction.
    stats: std::collections::BTreeMap<(Pubkey, StableFlowDirection), (u64, f64, f64)>,
}

impl StableFlowSpikeTracker {
    pub fn new() -> Self { Self::default() }

    pub fn observe(
        &mut self,
        mint: Pubkey,
        direction: StableFlowDirection,
        notional_q64: u128,
        window_ms: u32,
        slot: u64,
    ) -> Option<StableIntelSignal> {
        let (n, mean, m2) = self.stats.entry((mint, direction)).or_insert((0, 0.0, 0.0));
        let x = notional_q64 as f64;
        let prev_mean = *mean;
        let prev_m2 = *m2;
        let prev_n = *n;
        *n = prev_n + 1;
        let delta = x - prev_mean;
        *mean = prev_mean + delta / (*n as f64);
        *m2 = prev_m2 + delta * (x - *mean);
        if *n < 32 {
            return None;
        }
        let var = *m2 / (*n as f64 - 1.0);
        let stddev = var.sqrt();
        if stddev <= 0.0 {
            return None;
        }
        let z = (x - *mean) / stddev;
        if z >= 5.0 {
            Some(StableIntelSignal::StableFlowSpike {
                mint,
                direction,
                notional_q64,
                window_ms,
                slot,
            })
        } else {
            None
        }
    }
}

// ── Pool depth collapse tracker ──────────────────────────────────────

#[derive(Default)]
pub struct StablePoolDepthCollapseTracker {
    /// Per-pool window of (slot, depth_q64).
    by_pool: std::collections::BTreeMap<Pubkey, VecDeque<(u64, u128)>>,
}

impl StablePoolDepthCollapseTracker {
    pub fn new() -> Self { Self::default() }

    pub fn observe(&mut self, pool: Pubkey, mint: Pubkey, slot: u64, depth_q64: u128)
        -> Option<StableIntelSignal>
    {
        let q = self.by_pool.entry(pool).or_default();
        q.push_back((slot, depth_q64));
        let cutoff = slot.saturating_sub(TAU_DEPTH_WINDOW_SLOTS);
        while let Some((s, _)) = q.front() {
            if *s < cutoff {
                q.pop_front();
            } else {
                break;
            }
        }
        let max_depth = q.iter().map(|(_, d)| *d).max().unwrap_or(0);
        if max_depth == 0 {
            return None;
        }
        let drop_bps = ((max_depth.saturating_sub(depth_q64)).saturating_mul(10_000)) / max_depth;
        if (drop_bps as u32) >= TAU_DEPTH_DROP_BPS {
            Some(StableIntelSignal::StablePoolDepthCollapse {
                pool,
                mint,
                depth_drop_bps: drop_bps as u32,
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

    fn k(b: u8) -> Pubkey { [b; 32] }

    #[test]
    fn peg_deviation_fires_on_k_consecutive_breaches() {
        let mut t = PegDeviationTracker::new();
        for slot in 0..7 {
            assert!(t.observe(k(1), slot, 60, "twap").is_none());
        }
        let s = t.observe(k(1), 7, 60, "twap").unwrap();
        assert!(matches!(s, StableIntelSignal::PegDeviation { .. }));
    }

    #[test]
    fn peg_deviation_resets_when_a_clean_slot_appears() {
        let mut t = PegDeviationTracker::new();
        for slot in 0..7 {
            t.observe(k(1), slot, 60, "twap");
        }
        // One clean slot resets the streak.
        assert!(t.observe(k(1), 7, 30, "twap").is_none());
        assert!(t.observe(k(1), 8, 60, "twap").is_none());
    }

    #[test]
    fn flow_spike_fires_above_5_sigma() {
        let mut t = StableFlowSpikeTracker::new();
        // Prime with 32 small modestly-varied samples.
        for i in 0..32u64 {
            let amt = 1_000u128 + (i as u128 % 50);
            t.observe(k(1), StableFlowDirection::Outflow, amt, 1_000, i);
        }
        let s = t.observe(k(1), StableFlowDirection::Outflow, 1_000_000, 1_000, 100).unwrap();
        assert!(matches!(s, StableIntelSignal::StableFlowSpike { .. }));
    }

    #[test]
    fn flow_spike_silent_under_5_sigma() {
        let mut t = StableFlowSpikeTracker::new();
        for i in 0..32u64 {
            let amt = 1_000u128 + (i as u128 % 50);
            t.observe(k(1), StableFlowDirection::Inflow, amt, 1_000, i);
        }
        // Slight bump — well below 5σ.
        assert!(t
            .observe(k(1), StableFlowDirection::Inflow, 1_100, 1_000, 100)
            .is_none());
    }

    #[test]
    fn depth_collapse_fires_above_threshold() {
        let mut t = StablePoolDepthCollapseTracker::new();
        // Establish high-water mark at 100, then drop to 50 (50 % drop > 40 %).
        for i in 0..10u64 {
            t.observe(k(2), k(1), i, 100);
        }
        let s = t.observe(k(2), k(1), 100, 50).unwrap();
        assert!(matches!(s, StableIntelSignal::StablePoolDepthCollapse { .. }));
    }

    #[test]
    fn depth_collapse_silent_on_minor_drop() {
        let mut t = StablePoolDepthCollapseTracker::new();
        for i in 0..10u64 {
            t.observe(k(2), k(1), i, 100);
        }
        // 10 % drop — below threshold.
        assert!(t.observe(k(2), k(1), 100, 90).is_none());
    }
}
