//! Freshness gate (directive §8 third bullet).
//!
//! The on-chain verifier asserts both gates before reading the price
//! account; this crate exposes the same predicate so the keeper can
//! fail before submitting.

/// 4 slots = ~1.6 s at 400 ms slot time. Wider tolerance lets a single
/// missed leader slot still verify; tighter would force defensive mode
/// on every minor leader hiccup.
pub const MAX_LAG_SLOTS: u64 = 4;
/// 80 bps = 0.80 %. Above this, the price update's confidence is too
/// wide to commit to a rebalance.
pub const MAX_CONF_BPS: u32 = 80;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FreshnessError {
    #[error("posted_slot {posted_slot} lags target {bundle_target_slot} by {lag} > {MAX_LAG_SLOTS}")]
    StalePost {
        posted_slot: u64,
        bundle_target_slot: u64,
        lag: u64,
    },
    #[error("confidence {conf_bps} bps > MAX {MAX_CONF_BPS} bps")]
    ConfidenceTooWide { conf_bps: u32 },
}

/// Run the same predicate the on-chain verifier ix uses. Returns
/// `Ok(())` only if both gates pass.
pub fn verify_freshness(
    posted_slot: u64,
    bundle_target_slot: u64,
    conf_bps: u32,
) -> Result<(), FreshnessError> {
    let lag = bundle_target_slot.saturating_sub(posted_slot);
    if lag > MAX_LAG_SLOTS {
        return Err(FreshnessError::StalePost {
            posted_slot,
            bundle_target_slot,
            lag,
        });
    }
    if conf_bps > MAX_CONF_BPS {
        return Err(FreshnessError::ConfidenceTooWide { conf_bps });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boundary_4_slot_lag_passes() {
        verify_freshness(96, 100, 30).unwrap();
    }

    #[test]
    fn five_slot_lag_rejects() {
        assert!(matches!(
            verify_freshness(95, 100, 30),
            Err(FreshnessError::StalePost { .. })
        ));
    }

    #[test]
    fn confidence_at_max_passes() {
        verify_freshness(100, 100, MAX_CONF_BPS).unwrap();
    }

    #[test]
    fn confidence_above_max_rejects() {
        assert!(matches!(
            verify_freshness(100, 100, MAX_CONF_BPS + 1),
            Err(FreshnessError::ConfidenceTooWide { .. })
        ));
    }

    #[test]
    fn future_post_passes_without_underflow() {
        // posted_slot > bundle_target → lag saturates to 0.
        verify_freshness(105, 100, 30).unwrap();
    }
}
