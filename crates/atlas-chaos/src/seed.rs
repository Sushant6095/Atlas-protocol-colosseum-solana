//! Deterministic chaos RNG (directive §1.6).
//!
//! SplitMix64 — small, deterministic, good enough for chaos
//! parameter draws. Same seed → same byte-for-byte run.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChaosRng {
    state: u64,
}

impl ChaosRng {
    pub const fn new(seed: u64) -> Self {
        // Avoid the degenerate 0 state — seed 0 is the most common
        // unintentional input.
        let s = if seed == 0 { 0xa5a5_a5a5_a5a5_a5a5 } else { seed };
        Self { state: s }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = splitmix64(self.state);
        self.state
    }

    /// Uniform u32 in `[0, max)`. Returns 0 if `max == 0`.
    pub fn gen_below(&mut self, max: u32) -> u32 {
        if max == 0 {
            return 0;
        }
        (self.next_u64() % max as u64) as u32
    }

    /// Uniform `[0, 10_000)` (bps).
    pub fn gen_bps(&mut self) -> u32 {
        self.gen_below(10_000)
    }

    /// Returns `true` with probability `prob_bps / 10_000`.
    pub fn coin(&mut self, prob_bps: u32) -> bool {
        self.gen_bps() < prob_bps.min(10_000)
    }
}

pub fn splitmix64(state: u64) -> u64 {
    let mut z = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_sequence() {
        let mut a = ChaosRng::new(42);
        let mut b = ChaosRng::new(42);
        for _ in 0..100 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn different_seeds_different_sequences() {
        let mut a = ChaosRng::new(42);
        let mut b = ChaosRng::new(43);
        let av: Vec<u64> = (0..16).map(|_| a.next_u64()).collect();
        let bv: Vec<u64> = (0..16).map(|_| b.next_u64()).collect();
        assert_ne!(av, bv);
    }

    #[test]
    fn coin_respects_probability_bounds() {
        let mut r = ChaosRng::new(7);
        // p=0 always false.
        for _ in 0..1_000 {
            assert!(!r.coin(0));
        }
        let mut r = ChaosRng::new(7);
        // p=10_000 always true.
        for _ in 0..1_000 {
            assert!(r.coin(10_000));
        }
    }

    #[test]
    fn gen_below_bounds() {
        let mut r = ChaosRng::new(11);
        for _ in 0..1_000 {
            let x = r.gen_below(100);
            assert!(x < 100);
        }
    }

    #[test]
    fn zero_seed_does_not_lock_state() {
        let mut r = ChaosRng::new(0);
        let a = r.next_u64();
        let b = r.next_u64();
        assert_ne!(a, b);
    }
}
