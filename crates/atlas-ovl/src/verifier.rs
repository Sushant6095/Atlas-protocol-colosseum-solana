//! Pyth pull-oracle verifier read pattern (directive §2.4 + §5 deliverable).
//!
//! Pure off-chain mirror of the on-chain `atlas_verifier` Pyth read CPI
//! (Phase 5 wires the actual CPI). Returning `Ok(price_q64)` here is
//! exactly the contract the on-chain verifier enforces inside the
//! `execute_rebalance` ix: stale or wrong-feed updates short-circuit the
//! tx before any DeFi CPI fires.

use crate::keeper::{validate_posted_update, PostedPriceUpdate, PullOraclePostError};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct VerifiedPrice {
    pub feed_id: u32,
    pub price_q64: i64,
    pub conf_q64: u64,
    pub posted_slot: u64,
}

/// On-chain-equivalent verifier read. Calling this off-chain produces the
/// same Result the on-chain Phase 5 CPI will produce — replay parity.
pub fn verify_posted_update(
    bundle_target_slot: u64,
    expected_feed: u32,
    posted: &PostedPriceUpdate,
) -> Result<VerifiedPrice, PullOraclePostError> {
    validate_posted_update(expected_feed, bundle_target_slot, posted)?;
    Ok(VerifiedPrice {
        feed_id: posted.feed_id,
        price_q64: posted.price_q64,
        conf_q64: posted.conf_q64,
        posted_slot: posted.posted_slot,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn update(feed: u32, slot: u64) -> PostedPriceUpdate {
        PostedPriceUpdate {
            feed_id: feed,
            price_q64: 1_000_000,
            conf_q64: 100,
            posted_slot: slot,
        }
    }

    #[test]
    fn fresh_update_verifies() {
        let u = update(1, 100);
        let v = verify_posted_update(102, 1, &u).unwrap();
        assert_eq!(v.feed_id, 1);
        assert_eq!(v.price_q64, 1_000_000);
    }

    #[test]
    fn boundary_lag_4_verifies() {
        let u = update(1, 100);
        verify_posted_update(104, 1, &u).unwrap();
    }

    #[test]
    fn lag_5_rejects() {
        let u = update(1, 100);
        let err = verify_posted_update(105, 1, &u).unwrap_err();
        assert!(matches!(err, PullOraclePostError::Stale { .. }));
    }

    #[test]
    fn wrong_feed_rejects() {
        let u = update(7, 100);
        let err = verify_posted_update(102, 1, &u).unwrap_err();
        assert!(matches!(err, PullOraclePostError::WrongFeed { .. }));
    }
}
