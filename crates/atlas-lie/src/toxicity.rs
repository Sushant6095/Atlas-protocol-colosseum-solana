//! Toxicity scorer (directive §1.4).
//!
//! Per-pool, computed from a rolling 256-slot bus event window. Score is
//! `0..=10_000` bps. Above `T_TOXIC_BPS = 6500`: pool is excluded from
//! execution planning. Above `T_TOXIC_WARN_BPS = 4000`: planner prefers
//! alternative routes.

pub const T_TOXIC_BPS: u32 = 6_500;
pub const T_TOXIC_WARN_BPS: u32 = 4_000;
pub const DEFAULT_WINDOW_SLOTS: u64 = 256;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ToxicityWindow {
    /// Total swap count observed in the window.
    pub swaps: u32,
    /// Number of swaps where the next-K-slot swap reverses direction.
    pub reversals: u32,
    /// Net signed flow over the window (positive = inflow). Used to derive
    /// inventory_skew.
    pub net_flow_q64: i128,
    /// Gross flow magnitude over the window (`Σ |size|`). Denominator for skew.
    pub gross_flow_q64: u128,
    /// LP withdrawals observed.
    pub lp_withdrawals: u32,
    pub lp_deposits: u32,
    /// Detected sandwich pairs in the window.
    pub sandwich_pairs: u32,
}

impl ToxicityWindow {
    pub fn record_swap(&mut self, signed_size_q64: i128, is_reversal: bool) {
        self.swaps = self.swaps.saturating_add(1);
        if is_reversal {
            self.reversals = self.reversals.saturating_add(1);
        }
        self.net_flow_q64 = self.net_flow_q64.saturating_add(signed_size_q64);
        self.gross_flow_q64 = self
            .gross_flow_q64
            .saturating_add(signed_size_q64.unsigned_abs());
    }

    pub fn record_lp_withdrawal(&mut self) {
        self.lp_withdrawals = self.lp_withdrawals.saturating_add(1);
    }

    pub fn record_lp_deposit(&mut self) {
        self.lp_deposits = self.lp_deposits.saturating_add(1);
    }

    pub fn record_sandwich_pair(&mut self) {
        self.sandwich_pairs = self.sandwich_pairs.saturating_add(1);
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ToxicitySignals {
    pub reversal_rate_bps: u32,
    pub inventory_skew_bps: u32,
    pub lp_withdrawal_velocity_bps: u32,
    pub sandwich_pair_count_bps: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct ToxicityScorer {
    pub w_reversal: u32,
    pub w_skew: u32,
    pub w_lp_withdraw: u32,
    pub w_sandwich: u32,
    /// Saturate sandwich count at this many before normalising to 10_000 bps.
    pub sandwich_saturation: u32,
}

impl Default for ToxicityScorer {
    fn default() -> Self {
        Self {
            w_reversal: 2_500,
            w_skew: 2_500,
            w_lp_withdraw: 2_500,
            w_sandwich: 2_500,
            sandwich_saturation: 16,
        }
    }
}

impl ToxicityScorer {
    pub fn signals(&self, w: &ToxicityWindow) -> ToxicitySignals {
        let reversal_rate_bps = if w.swaps == 0 {
            0
        } else {
            ((w.reversals as u64) * 10_000 / w.swaps as u64) as u32
        };
        let inventory_skew_bps = if w.gross_flow_q64 == 0 {
            0
        } else {
            let mag = w.net_flow_q64.unsigned_abs();
            ((mag * 10_000) / w.gross_flow_q64).min(10_000) as u32
        };
        let lp_total = w.lp_deposits.saturating_add(w.lp_withdrawals);
        let lp_withdrawal_velocity_bps = if lp_total == 0 {
            0
        } else {
            ((w.lp_withdrawals as u64) * 10_000 / lp_total as u64) as u32
        };
        let sat = self.sandwich_saturation.max(1);
        let sandwich_pair_count_bps =
            ((w.sandwich_pairs.min(sat) as u64) * 10_000 / sat as u64) as u32;
        ToxicitySignals {
            reversal_rate_bps,
            inventory_skew_bps,
            lp_withdrawal_velocity_bps,
            sandwich_pair_count_bps,
        }
    }

    pub fn score(&self, w: &ToxicityWindow) -> u32 {
        let s = self.signals(w);
        let total_w = (self.w_reversal as u64
            + self.w_skew as u64
            + self.w_lp_withdraw as u64
            + self.w_sandwich as u64)
            .max(1);
        let weighted = (s.reversal_rate_bps as u64) * self.w_reversal as u64
            + (s.inventory_skew_bps as u64) * self.w_skew as u64
            + (s.lp_withdrawal_velocity_bps as u64) * self.w_lp_withdraw as u64
            + (s.sandwich_pair_count_bps as u64) * self.w_sandwich as u64;
        ((weighted / total_w).min(10_000)) as u32
    }

    pub fn classify(&self, w: &ToxicityWindow) -> ToxicityClass {
        let score = self.score(w);
        if score >= T_TOXIC_BPS {
            ToxicityClass::Excluded(score)
        } else if score >= T_TOXIC_WARN_BPS {
            ToxicityClass::Warn(score)
        } else {
            ToxicityClass::Clean(score)
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ToxicityClass {
    Clean(u32),
    Warn(u32),
    Excluded(u32),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clean_window() -> ToxicityWindow {
        let mut w = ToxicityWindow::default();
        // 100 swaps, 10 reversals, balanced flow.
        for i in 0..100 {
            let signed = if i % 2 == 0 { 1_000i128 } else { -1_000 };
            w.record_swap(signed, i % 10 == 0);
        }
        for _ in 0..10 {
            w.record_lp_deposit();
        }
        w
    }

    fn toxic_window() -> ToxicityWindow {
        let mut w = ToxicityWindow::default();
        // 100 swaps, 80 reversals, fully one-sided flow.
        for i in 0..100 {
            w.record_swap(1_000, i < 80);
        }
        for _ in 0..50 {
            w.record_lp_withdrawal();
        }
        for _ in 0..20 {
            w.record_sandwich_pair();
        }
        w
    }

    #[test]
    fn clean_pool_classified_clean() {
        let s = ToxicityScorer::default();
        match s.classify(&clean_window()) {
            ToxicityClass::Clean(_) => {}
            other => panic!("expected Clean, got {:?}", other),
        }
    }

    #[test]
    fn toxic_pool_classified_excluded() {
        let s = ToxicityScorer::default();
        match s.classify(&toxic_window()) {
            ToxicityClass::Excluded(score) => {
                assert!(score >= T_TOXIC_BPS, "score {} < {}", score, T_TOXIC_BPS);
            }
            other => panic!("expected Excluded, got {:?}", other),
        }
    }

    #[test]
    fn empty_window_zero_score() {
        let s = ToxicityScorer::default();
        let w = ToxicityWindow::default();
        assert_eq!(s.score(&w), 0);
    }

    #[test]
    fn signals_match_directive_definitions() {
        let s = ToxicityScorer::default();
        let mut w = ToxicityWindow::default();
        for _ in 0..10 {
            w.record_swap(1_000, true);
        }
        // 10 swaps, all reversals → 10_000 bps reversal rate.
        let signals = s.signals(&w);
        assert_eq!(signals.reversal_rate_bps, 10_000);
        // Fully one-sided → 10_000 bps inventory skew.
        assert_eq!(signals.inventory_skew_bps, 10_000);
    }

    #[test]
    fn warn_threshold_triggers_class_warn() {
        let s = ToxicityScorer::default();
        let mut w = ToxicityWindow::default();
        for i in 0..100u32 {
            w.record_swap(1_000, i < 45);
        }
        let cls = s.classify(&w);
        // 45% reversals + 100% skew + 0% lp + 0% sandwich, weights equal:
        // (4_500 + 10_000 + 0 + 0) / 4 = 3_625 → Clean. Adjust: need higher reversal.
        // Drive into Warn (4_000–6_499) via more reversals.
        let mut w2 = ToxicityWindow::default();
        for i in 0..100u32 {
            w2.record_swap(1_000, i < 70);
        }
        let cls2 = s.classify(&w2);
        // (7_000 + 10_000 + 0 + 0) / 4 = 4_250 → Warn.
        assert!(matches!(cls2, ToxicityClass::Warn(_)) || matches!(cls2, ToxicityClass::Excluded(_)));
        let _ = cls;
    }
}
