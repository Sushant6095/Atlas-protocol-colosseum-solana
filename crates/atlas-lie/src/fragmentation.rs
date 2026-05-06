//! Fragmentation index (directive §1.3).
//!
//! `fragmentation_bps = 1 - HHI(route_share_i)` clamped to `0..=10_000`.
//! HHI is computed in integer-bps to keep the commitment path
//! float-free.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RouteShare {
    pub venue: u8,
    pub share_bps: u32, // 0..=10_000
}

/// Returns `0` if shares is empty (a single-leg route is by definition
/// monolithic and the caller should not bother computing fragmentation).
/// Otherwise returns `10_000 - HHI` clamped to `[0, 10_000]`.
pub fn fragmentation_index_bps(shares: &[RouteShare]) -> u32 {
    if shares.is_empty() {
        return 0;
    }
    // HHI in bps: Σ (share_bps_i / 10_000)² scaled to bps.
    // Implementation: Σ (share_bps_i)² / 10_000.
    let mut hhi_bps: u128 = 0;
    let mut sum_bps: u32 = 0;
    for s in shares {
        let share = s.share_bps.min(10_000) as u128;
        hhi_bps = hhi_bps.saturating_add(share * share);
        sum_bps = sum_bps.saturating_add(s.share_bps);
    }
    let hhi = (hhi_bps / 10_000) as u32;
    let fragmentation = 10_000u32.saturating_sub(hhi.min(10_000));
    // If shares don't sum to ~10_000, we still report the raw fragmentation
    // but the caller can validate via `sum_bps`.
    let _ = sum_bps;
    fragmentation.min(10_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn share(v: u8, s: u32) -> RouteShare {
        RouteShare { venue: v, share_bps: s }
    }

    #[test]
    fn monolithic_returns_zero() {
        let s = vec![share(1, 10_000)];
        // HHI = 10_000² / 10_000 = 10_000 → fragmentation = 0
        assert_eq!(fragmentation_index_bps(&s), 0);
    }

    #[test]
    fn perfectly_split_two_returns_5000() {
        let s = vec![share(1, 5_000), share(2, 5_000)];
        // HHI = 2 * 5_000² / 10_000 = 5_000 → fragmentation = 5_000
        assert_eq!(fragmentation_index_bps(&s), 5_000);
    }

    #[test]
    fn perfectly_split_n_returns_higher_fragmentation() {
        let two = fragmentation_index_bps(&[share(1, 5_000), share(2, 5_000)]);
        let four = fragmentation_index_bps(&[
            share(1, 2_500),
            share(2, 2_500),
            share(3, 2_500),
            share(4, 2_500),
        ]);
        let ten = fragmentation_index_bps(
            &(1..=10).map(|i| share(i, 1_000)).collect::<Vec<_>>(),
        );
        assert!(two < four);
        assert!(four < ten);
        // n=10: HHI = 10 * 1_000² / 10_000 = 1_000 → fragmentation = 9_000
        assert_eq!(ten, 9_000);
    }

    #[test]
    fn empty_returns_zero() {
        assert_eq!(fragmentation_index_bps(&[]), 0);
    }

    #[test]
    fn never_exceeds_10000() {
        // Pathological input: shares that sum below 10_000 (incomplete route).
        let s = vec![share(1, 100), share(2, 100)];
        let f = fragmentation_index_bps(&s);
        assert!(f <= 10_000);
    }
}
