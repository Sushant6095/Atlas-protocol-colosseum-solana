//! A/B comparison + paired bootstrap CIs (directive §1.5).

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MetricDelta {
    pub name: String,
    pub value_a: f64,
    pub value_b: f64,
    pub delta: f64,
    /// 95 % CI on the delta from the bootstrap.
    pub ci_low: f64,
    pub ci_high: f64,
    pub significant_at_95: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ComparisonReport {
    pub n_observations: u32,
    pub n_bootstraps: u32,
    pub deltas: Vec<MetricDelta>,
}

/// Paired bootstrap on the difference of means. Returns the 95 % CI on the
/// delta. Deterministic for a given seed (PCG-style xorshift below). Inputs
/// must be the same length — paired by rebalance index across the two runs.
pub fn paired_bootstrap_ci(
    a: &[f64],
    b: &[f64],
    n_bootstraps: u32,
    seed: u64,
) -> (f64, f64, f64) {
    assert_eq!(a.len(), b.len(), "paired bootstrap requires equal lengths");
    let n = a.len();
    if n == 0 {
        return (0.0, 0.0, 0.0);
    }
    let diffs: Vec<f64> = a.iter().zip(b.iter()).map(|(x, y)| *y - *x).collect();
    let mean_delta: f64 = diffs.iter().sum::<f64>() / n as f64;
    let mut samples: Vec<f64> = Vec::with_capacity(n_bootstraps as usize);
    let mut state = seed.max(1);
    for _ in 0..n_bootstraps {
        let mut sum = 0.0;
        for _ in 0..n {
            state = next_rng(state);
            let idx = (state as usize) % n;
            sum += diffs[idx];
        }
        samples.push(sum / n as f64);
    }
    samples.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
    let lo = samples[((n_bootstraps as f64) * 0.025) as usize];
    let hi = samples[((n_bootstraps as f64) * 0.975).min(n_bootstraps as f64 - 1.0) as usize];
    (mean_delta, lo, hi)
}

fn next_rng(state: u64) -> u64 {
    // SplitMix64 — small + deterministic, good enough for bootstrap.
    let mut z = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ci_brackets_a_known_constant_shift() {
        // B is uniformly +50 above A. Delta should center at +50.
        let a: Vec<f64> = (0..200).map(|i| i as f64).collect();
        let b: Vec<f64> = (0..200).map(|i| (i as f64) + 50.0).collect();
        let (mean, lo, hi) = paired_bootstrap_ci(&a, &b, 1_000, 42);
        assert!((mean - 50.0).abs() < 1e-9);
        // Constant shift → variance of diffs is 0 → CI collapses to 50.
        assert!((lo - 50.0).abs() < 1e-9);
        assert!((hi - 50.0).abs() < 1e-9);
    }

    #[test]
    fn ci_widens_with_noise() {
        // B is +50 above A but with alternating noise.
        let a: Vec<f64> = (0..400).map(|i| i as f64).collect();
        let b: Vec<f64> = (0..400)
            .map(|i| (i as f64) + 50.0 + if i % 2 == 0 { 20.0 } else { -20.0 })
            .collect();
        let (mean, lo, hi) = paired_bootstrap_ci(&a, &b, 1_000, 42);
        assert!((mean - 50.0).abs() < 1.0);
        assert!(lo < 50.0);
        assert!(hi > 50.0);
    }

    #[test]
    fn deterministic_for_same_seed() {
        let a: Vec<f64> = (0..100).map(|i| i as f64 * 1.5).collect();
        let b: Vec<f64> = (0..100).map(|i| i as f64 * 2.5).collect();
        let r1 = paired_bootstrap_ci(&a, &b, 500, 7);
        let r2 = paired_bootstrap_ci(&a, &b, 500, 7);
        assert_eq!(r1, r2);
    }
}
