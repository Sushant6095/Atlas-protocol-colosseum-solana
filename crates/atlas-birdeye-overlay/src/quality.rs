//! Yield-quality overlay (directive §3.4).
//!
//! Composite `quality_score_bps` from Birdeye depth + holder
//! distribution + age + Atlas's Phase 04 toxicity. Surfaces on the
//! dashboard and influences agent confidence weights — but only via
//! the auditable feature path (Phase 01 stage 03), never as a side
//! channel into commitment.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct QualityInputs {
    /// Pool depth at ±1 % in bps — higher is better.
    pub depth_bps: u32,
    /// Holder dispersion (Gini-inverse) in bps — higher is better.
    pub holder_dispersion_bps: u32,
    /// Pool age clamped to a confidence-yielding window in bps.
    pub age_bps: u32,
    /// Atlas Phase 04 toxicity in bps — lower is better; flipped here.
    pub toxicity_bps: u32,
}

/// Returns a 0..=10_000 quality score. Weights chosen to reflect the
/// directive's "depth and dispersion drive trust; toxicity drags it".
pub fn compute_quality_score(i: QualityInputs) -> u32 {
    let depth = i.depth_bps.min(10_000) as u64;
    let disp = i.holder_dispersion_bps.min(10_000) as u64;
    let age = i.age_bps.min(10_000) as u64;
    let inv_tox = 10_000_u64.saturating_sub(i.toxicity_bps as u64);
    // Weighted average: 35 % depth, 25 % dispersion, 15 % age, 25 % inverse toxicity.
    let raw = depth * 35 + disp * 25 + age * 15 + inv_tox * 25;
    (raw / 100).min(10_000) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perfect_inputs_score_max() {
        let q = compute_quality_score(QualityInputs {
            depth_bps: 10_000,
            holder_dispersion_bps: 10_000,
            age_bps: 10_000,
            toxicity_bps: 0,
        });
        assert_eq!(q, 10_000);
    }

    #[test]
    fn worst_inputs_score_zero() {
        let q = compute_quality_score(QualityInputs {
            depth_bps: 0,
            holder_dispersion_bps: 0,
            age_bps: 0,
            toxicity_bps: 10_000,
        });
        assert_eq!(q, 0);
    }

    #[test]
    fn high_toxicity_drags_score() {
        let healthy = compute_quality_score(QualityInputs {
            depth_bps: 8_000,
            holder_dispersion_bps: 8_000,
            age_bps: 8_000,
            toxicity_bps: 1_000,
        });
        let toxic = compute_quality_score(QualityInputs {
            depth_bps: 8_000,
            holder_dispersion_bps: 8_000,
            age_bps: 8_000,
            toxicity_bps: 7_000,
        });
        assert!(toxic < healthy);
    }
}
